"""Kiểm dịch vụ ACL/AES với DB SQLite trong RAM; không dùng .env, PostgreSQL, RPC hay Pinata thật."""
import os
import sqlite3
import unittest
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.core import crypto
from app.db.base import Base
from app.db.models import Document, DocumentGrant
from app.services import document_service as service
from app.services.chain import ChainUnavailable
from helpers import FakeChain, FakeIpfs


class PrivateDocumentsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # PostgreSQL nhận UUID trực tiếp; SQLite test lưu Uuid dưới dạng hex CHAR(32).
        sqlite3.register_adapter(uuid.UUID, lambda value: value.hex)

    def setUp(self):
        self.engine = create_engine('sqlite://')
        @event.listens_for(self.engine, 'connect')
        def functions(connection, _):
            connection.create_function('now', 0, lambda: datetime.now(timezone.utc).isoformat(' '))
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.chain, self.ipfs = FakeChain(), FakeIpfs()
        self.wallets = {name: '0x' + f'{index:02x}' * 20 for index, name in enumerate(
            ('farmerA', 'farmerB', 'logistics', 'retailer', 'admin', 'consumer'), 1)}
        for name, role in (('farmerA', 'FARMER_ROLE'), ('farmerB', 'FARMER_ROLE'),
                           ('logistics', 'LOGISTICS_ROLE'), ('retailer', 'RETAILER_ROLE'), ('admin', 'ADMIN_ROLE')):
            self.chain.give(self.wallets[name], role)
        self.master = os.urandom(32).hex()
        self.plain = b'%PDF-1.7 private invoice\n' + os.urandom(64)
        self.doc = service.create_document(self.db, self.ipfs, self.master, self.wallets['farmerA'], 'invoice', self.plain)
        self.chain.creators[1] = self.wallets['farmerA']
        service.bind_document(self.db, self.chain, self.wallets['farmerA'], self.doc.id, '1', None)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def grant(self, who='retailer'):
        return service.grant_access(self.db, self.chain, self.wallets['farmerA'], self.doc.id, self.wallets[who])

    def read(self, who):
        return service.read_private_document(self.db, self.chain, self.ipfs, self.master, self.wallets[who], self.doc.id)[1]

    def test_ciphertext_roundtrip_and_acl_matrix(self):
        self.grant('logistics'); self.grant('retailer')
        self.assertNotIn(self.plain, self.ipfs.store[self.doc.cid])
        for who in ('farmerA', 'logistics', 'retailer'):
            self.assertEqual(self.read(who), self.plain)
        for who in ('farmerB', 'admin', 'consumer'):
            with self.subTest(wallet=who), self.assertRaises(service.AccessDenied):
                self.read(who)

    def test_revoke_blocks_read_and_list_regrant_reuses_row(self):
        self.grant()
        self.assertEqual(len(service.list_private_documents(self.db, self.chain, self.wallets['retailer'], '1')), 1)
        service.revoke_grant(self.db, self.wallets['farmerA'], self.doc.id, self.wallets['retailer'])
        with self.assertRaises(service.AccessDenied): self.read('retailer')
        self.assertEqual(service.list_private_documents(self.db, self.chain, self.wallets['retailer'], '1'), [])
        _, created = self.grant()
        self.assertFalse(created)
        self.assertEqual(self.db.query(DocumentGrant).count(), 1)
        self.assertEqual(self.read('retailer'), self.plain)

    def test_revoked_onchain_role_and_rpc_failure_deny_read(self):
        self.grant()
        self.chain.take(self.wallets['retailer'], 'RETAILER_ROLE')
        with self.assertRaises(service.AccessDenied): self.read('retailer')
        with self.assertRaises(service.AccessDenied):
            service.list_private_documents(self.db, self.chain, self.wallets['retailer'], '1')
        self.chain.down = True
        with self.assertRaises(ChainUnavailable): self.read('farmerA')

    def test_only_uploader_manages_grants(self):
        self.grant()
        for who in ('farmerB', 'admin', 'retailer'):
            with self.subTest(wallet=who), self.assertRaises(service.NotUploader):
                service.grant_access(self.db, self.chain, self.wallets[who], self.doc.id, self.wallets['logistics'])
            with self.subTest(wallet=who), self.assertRaises(service.NotUploader):
                service.revoke_grant(self.db, self.wallets[who], self.doc.id, self.wallets['retailer'])
        with self.assertRaises(service.WalletNotEligible): self.grant('consumer')

    def test_grantees_cannot_see_grant_list(self):
        self.grant()
        self.assertIsNone(service.list_private_documents(self.db, self.chain, self.wallets['retailer'], '1')[0][1])
        self.assertEqual(len(service.list_private_documents(self.db, self.chain, self.wallets['farmerA'], '1')[0][1]), 1)
        self.assertEqual(service.list_private_documents(self.db, self.chain, self.wallets['farmerB'], '1'), [])

    def test_tampered_package_rejected_including_version(self):
        original = self.ipfs.store[self.doc.cid]
        for offset in (0, 3, 5, crypto.HEADER_BYTES - 1, len(original) - 1):
            changed = bytearray(original); changed[offset] ^= 1
            self.ipfs.store[self.doc.cid] = bytes(changed)
            with self.subTest(offset=offset), self.assertRaises(crypto.CiphertextInvalid): self.read('farmerA')

    def test_wrong_key_and_plaintext_hash_rejected(self):
        saved = self.master
        self.master = os.urandom(32).hex()
        with self.assertRaises(crypto.CiphertextInvalid): self.read('farmerA')
        self.master = saved
        self.doc.sha256 = b'\x00' * 32
        self.db.commit()
        with self.assertRaises(crypto.CiphertextInvalid): self.read('farmerA')

    def test_invoice_bind_requires_actual_creator_not_current_owner(self):
        doc = service.create_document(self.db, self.ipfs, self.master, self.wallets['farmerB'], 'invoice', self.plain)
        self.chain.owners[1] = self.wallets['farmerB']
        with self.assertRaises(service.NotUploader):
            service.bind_document(self.db, self.chain, self.wallets['farmerB'], doc.id, '1', None)
        self.assertIsNone(self.db.get(Document, doc.id).token_id)

    def test_fresh_encryption_and_gateway_failure(self):
        second = service.create_document(self.db, self.ipfs, self.master, self.wallets['farmerA'], 'invoice', self.plain)
        self.assertNotEqual(self.ipfs.store[self.doc.cid], self.ipfs.store[second.cid])
        self.assertNotEqual(self.doc.wrapped_key, second.wrapped_key)
        self.ipfs.fail_fetch = True
        from app.services.ipfs import IpfsFetchError
        with self.assertRaises(IpfsFetchError): self.read('farmerA')


if __name__ == '__main__':
    unittest.main()
