"""Kiểm tra thuần byte/adapter; không dùng DB, RPC, .env hay tài khoản Pinata."""
import hashlib
import json
import unittest
from contextlib import nullcontext
from unittest.mock import patch

import httpx

from app.services.ipfs import IpfsFetchError, IpfsUploadError, PinataClient
from app.services.metadata import MetadataInvalid, check_metadata
from app.services.upload_rules import FileTooLarge, UnsupportedContent, sha256_of, validate_content


class FileIntegrityTests(unittest.TestCase):
    def test_image_signatures(self):
        for content, mime in (
            (b'\xff\xd8\xfforiginal', 'image/jpeg'),
            (b'\x89PNG\r\n\x1a\noriginal', 'image/png'),
            (b'RIFF\x20\x00\x00\x00WEBPVP8 original', 'image/webp'),
            (b'RIFF\x20\x00\x00\x00WEBPVP8Loriginal', 'image/webp'),
            (b'RIFF\x20\x00\x00\x00WEBPVP8Xoriginal', 'image/webp'),
        ):
            with self.subTest(mime=mime, content=content):
                self.assertEqual(validate_content('image', content), mime)
                self.assertEqual(sha256_of(content), hashlib.sha256(content).digest())

    def test_reject_non_images_and_truncated_headers(self):
        for content in (b'<svg/>', b'GIF89a', b'%PDF-1.7', b'\x89PNG', b'RIFF0000WEBP', b'RIFF0000WAVExxxx'):
            with self.subTest(content=content), self.assertRaises(UnsupportedContent):
                validate_content('image', content)

    def test_pdf_and_size_limit(self):
        self.assertEqual(validate_content('certificate', b'%PDF-1.7\noriginal'), 'application/pdf')
        with self.assertRaises(UnsupportedContent):
            validate_content('certificate', b'<svg/>')
        with self.assertRaises(FileTooLarge):
            validate_content('image', b'x' * (10 * 1024 * 1024 + 1))

    def test_metadata_bytes_and_nonfinite_temperature(self):
        data = dict(name='Test', description='Test', batchCode='TEST', farmId='FARM-A',
                    harvestGroupId='HG-A01', cultivar='Dừa', fertilizer='Hữu cơ', farmLocation='Bến Tre',
                    image='ipfs://abcdefghijk', certificateURI='ipfs://lmnopqrstuv',
                    certificateSHA256='a' * 64, imageSHA256='b' * 64, schemaVersion=1,
                    tempMin=8, tempMax=15, quantityKg=1000)
        original = json.dumps(data, ensure_ascii=False, indent=2).encode()
        self.assertEqual(check_metadata(original)['quantityKg'], 1000)
        self.assertNotEqual(sha256_of(original), sha256_of(json.dumps(data).encode()))
        for invalid in (float('nan'), float('inf'), float('-inf')):
            data['tempMin'] = invalid
            with self.assertRaises(MetadataInvalid):
                check_metadata(json.dumps(data).encode())

    def test_upload_preserves_bytes_and_mime(self):
        original = b'RIFF0000WEBPVP8 original'
        response = httpx.Response(200, json={'data': {'cid': 'abcdefghijk'}}, request=httpx.Request('POST', 'https://example.test'))
        with patch('app.services.ipfs.httpx.post', return_value=response) as post:
            self.assertEqual(PinataClient('test-only').upload(original, 'image.webp', 'image/webp'), 'abcdefghijk')
            self.assertEqual(post.call_args.kwargs['files']['file'], ('image.webp', original, 'image/webp'))

    def test_upload_rejects_malformed_response(self):
        for body in (None, [], {'data': None}, {'data': {'cid': 12}}, {'data': {'cid': '../bad'}}):
            response = httpx.Response(200, json=body, request=httpx.Request('POST', 'https://example.test'))
            with patch('app.services.ipfs.httpx.post', return_value=response), self.assertRaises(IpfsUploadError):
                PinataClient('test-only').upload(b'original', 'file')

    def test_gateway_fallback_preserves_bytes(self):
        original = b'%PDF-1.7\noriginal\x00\xff'
        failed = httpx.Response(503, request=httpx.Request('GET', 'https://example.test'))
        success = httpx.Response(200, content=original, request=httpx.Request('GET', 'https://example.test'))
        with patch('app.services.ipfs.httpx.stream', side_effect=[nullcontext(failed), nullcontext(success)]) as stream:
            self.assertEqual(PinataClient('test-only').fetch('abcdefghijk'), original)
            self.assertEqual(stream.call_count, 2)

    def test_gateway_rejects_oversize_and_invalid_cid(self):
        response = httpx.Response(200, content=b'12345', request=httpx.Request('GET', 'https://example.test'))
        with patch('app.services.ipfs.MAX_FETCH_BYTES', 4), patch('app.services.ipfs.httpx.stream', return_value=nullcontext(response)), self.assertRaises(IpfsFetchError):
            PinataClient('test-only').fetch('abcdefghijk')
        with self.assertRaises(IpfsFetchError):
            PinataClient('test-only').fetch('../bad')


if __name__ == '__main__':
    unittest.main()
