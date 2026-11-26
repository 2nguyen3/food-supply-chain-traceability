
"""Regression tests cho xác minh receipt của giao dịch createBatch.

Kiểm thử trực tiếp và qua DelegationManager.
Không cần RPC thật, database hoặc giao dịch Sepolia.
"""
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services.chain import ChainClient, ReceiptInvalid


CONTRACT = "0x650525fC71559CafcF37DcF8fA2844a5577f2FD3"
DELEGATION = "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3"
FARMER = "0x617b1eE58bF06460c0e3E051174d8131d3aB7d3E"

TX_HASH = "0x" + "ab" * 32
METADATA_CID = "bafy-test-metadata"
METADATA_HASH = bytes.fromhex("11" * 32)


def make_client(tx_to, event_addresses, status=1):
    """Tạo ChainClient giả lập để kiểm tra logic xác minh receipt."""
    receipt = {
        "status": status,
        "to": tx_to,
    }

    decoded_events = [
        {
            "address": address,
            "args": {
                "tokenId": 1,
                "farmer": FARMER,
                "metadataCID": METADATA_CID,
                "metadataHash": METADATA_HASH,
            },
        }
        for address in event_addresses
    ]

    event_parser = Mock()
    event_parser.process_receipt.return_value = decoded_events

    client = ChainClient.__new__(ChainClient)
    client._w3 = SimpleNamespace(
        eth=SimpleNamespace(
            get_transaction_receipt=Mock(return_value=receipt)
        )
    )
    client._contract = SimpleNamespace(
        address=CONTRACT,
        events=SimpleNamespace(
            BatchCreated=lambda: event_parser
        ),
    )
    return client


@pytest.mark.parametrize("tx_to", [CONTRACT, DELEGATION])
def test_accepts_valid_create_batch_direct_or_delegated(tx_to):
    client = make_client(tx_to, [CONTRACT])

    result = client.get_batch_created(TX_HASH)

    assert result["token_id"] == 1
    assert result["farmer"] == FARMER.lower()
    assert result["metadata_cid"] == METADATA_CID
    assert result["metadata_hash"] == METADATA_HASH


@pytest.mark.parametrize("event_addresses", [[], [DELEGATION]])
def test_rejects_receipt_without_cocomark_event(event_addresses):
    client = make_client(DELEGATION, event_addresses)

    with pytest.raises(ReceiptInvalid):
        client.get_batch_created(TX_HASH)


def test_rejects_failed_transaction():
    client = make_client(DELEGATION, [CONTRACT], status=0)

    with pytest.raises(ReceiptInvalid, match="status"):
        client.get_batch_created(TX_HASH)


def test_rejects_duplicate_batch_created_events():
    client = make_client(DELEGATION, [CONTRACT, CONTRACT])

    with pytest.raises(ReceiptInvalid):
        client.get_batch_created(TX_HASH)


def test_ignores_unrelated_contract_events():
    client = make_client(DELEGATION, [DELEGATION, CONTRACT])

    result = client.get_batch_created(TX_HASH)

    assert result["token_id"] == 1
    assert result["farmer"] == FARMER.lower()
