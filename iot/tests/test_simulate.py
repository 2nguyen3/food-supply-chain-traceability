"""Các ca C13, X04 và I07 cho simulator; không gửi giao dịch tới môi trường người dùng."""
import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from types import SimpleNamespace

SPEC = importlib.util.spec_from_file_location("simulate", Path(__file__).parents[1] / "simulate.py")
sim = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sim)


class SimulatorTests(unittest.TestCase):
    def test_explicit_config_does_not_read_dotenv(self):
        values = {'RPC_URL': 'http://127.0.0.1:18545', 'CHAIN_ID': '31337',
                  'CONTRACT_ADDRESS': '0x' + '1' * 40, 'DEPLOY_BLOCK': '1',
                  'IOT_LOGISTICS_ADDRESS': '0x' + '2' * 40}
        args = SimpleNamespace(manifest=None, dry_run=True, receipt=None)
        with patch.dict(sim.os.environ, values, clear=True), patch.object(sim, 'load_dotenv') as load:
            config = sim.settings(args)
        load.assert_not_called()
        self.assertEqual(config['chain'], 31337)

    def test_manifest_conflict_is_rejected(self):
        path = self.csv('')
        path.write_text('{"chainId":11155111}')
        values = {'RPC_URL': 'http://127.0.0.1:18545', 'CHAIN_ID': '31337',
                  'CONTRACT_ADDRESS': '0x' + '1' * 40, 'DEPLOY_BLOCK': '1',
                  'IOT_LOGISTICS_ADDRESS': '0x' + '2' * 40}
        args = SimpleNamespace(manifest=str(path), dry_run=True, receipt=None)
        with patch.dict(sim.os.environ, values, clear=True), self.assertRaisesRegex(sim.SimulationError, 'khác manifest'):
            sim.settings(args)

    def csv(self, body):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / "readings.csv"
        path.write_text("readingId,tokenId,tempCenti,observedAt,location\n" + body)
        return path

    def test_sample_and_token_override_preserve_units(self):
        rows = sim.read_rows(Path(__file__).parents[1] / "readings.csv", 7)
        self.assertEqual([r["tempCenti"] for r in rows], [1000, 1200, 1800, 1300, 1100])
        self.assertTrue(all(r["tokenId"] == 7 for r in rows))
        self.assertEqual(len([r for r in rows if not 800 <= r["tempCenti"] <= 1500]), 1)

    def test_duplicate_and_decimal_temperature_rejected(self):
        for body in ['1,3,1000,now,port\n1,3,1200,now,port\n', '1,3,12.5,now,port\n', '1,3,2147483648,now,port\n']:
            with self.subTest(body=body), self.assertRaises(sim.SimulationError):
                sim.read_rows(self.csv(body))

    def test_negative_temperature_and_large_token_are_exact(self):
        token = 2**200
        rows = sim.read_rows(self.csv(f'1,{token},-250,123,port\n'))
        self.assertEqual(rows[0]["tokenId"], token)
        self.assertEqual(rows[0]["tempCenti"], -250)

    def test_validates_entire_csv_before_count(self):
        with self.assertRaises(sim.SimulationError):
            sim.read_rows(self.csv('1,3,1000,now,port\n2,0,1000,now,port\n'), count=1)

    def test_receipt_timeout_keeps_hash_and_stops(self):
        w3 = Mock()
        w3.eth.wait_for_transaction_receipt.side_effect = sim.TimeExhausted()
        with self.assertRaisesRegex(sim.SimulationError, '--receipt 0xabc'):
            sim.receipt(w3, '0xabc', 1)
        w3.eth.send_raw_transaction.assert_not_called()

    def test_journal_preserves_location_and_status(self):
        path = self.csv('')
        path.unlink()
        sim.append_journal(path, {'location': '10.77,106.70', 'status': 'prepared'})
        sim.append_journal(path, {'location': '10.77,106.70', 'status': 'confirmed'})
        with path.open() as file:
            rows = list(csv.DictReader(file))
        self.assertEqual([r['status'] for r in rows], ['prepared', 'confirmed'])
        self.assertEqual(rows[0]['location'], '10.77,106.70')

    def test_batch_guards_and_observed_time(self):
        w3, contract = Mock(), Mock()
        config = {'wallet': '0xabc'}
        row = dict(tokenId=3, readingId=1, tempCenti=1800, observedAt='now', location='port')
        contract.functions.ownerOf.return_value.call.return_value = '0xabc'
        contract.functions.isExpired.return_value.call.return_value = False
        contract.functions.hasRole.return_value.call.return_value = True
        w3.eth.get_block.return_value = {'timestamp': 123}
        for lifecycle, recalled in [(0, False), (2, False), (3, False), (1, True)]:
            contract.functions.getBatch.return_value.call.return_value = [0] * 8 + [lifecycle, recalled]
            with self.assertRaises(sim.SimulationError):
                sim.validate_batch(w3, contract, config, row)
        contract.functions.getBatch.return_value.call.return_value = [0] * 8 + [1, False]
        _, observed = sim.validate_batch(w3, contract, config, row)
        self.assertEqual(observed, 123)
        contract.functions.recordTransit.assert_called_with(3, 1, 1800, 123, 'port')
        contract.functions.hasRole.return_value.call.return_value = False
        with self.assertRaises(sim.SimulationError):
            sim.validate_batch(w3, contract, config, row)


if __name__ == '__main__':
    unittest.main()
