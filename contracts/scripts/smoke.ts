import assert from "node:assert/strict";
import { network } from "hardhat";
import { id as keccakId, ZeroAddress } from "ethers";

const { ethers, networkHelpers } = await network.create();

async function main() {
  const [admin, farmer, logistics, retailer] = await ethers.getSigners();

  // 1. Deploy & roles
  const contract = await ethers.deployContract("FoodTraceability");
  const LOGISTICS_ROLE = await contract.LOGISTICS_ROLE();
  const RETAILER_ROLE = await contract.RETAILER_ROLE();

  await (await contract.connect(admin).assignFarmer(farmer.address, "FARM-01")).wait();
  await (await contract.connect(admin).grantRole(LOGISTICS_ROLE, logistics.address)).wait();
  await (await contract.connect(admin).grantRole(RETAILER_ROLE, retailer.address)).wait();
  console.log(`[1/7] deploy & roles OK contract=${await contract.getAddress()}`);

  // 2. createBatch
  const now = BigInt(await networkHelpers.time.latest());
  const THIRTY_DAYS = 30n * 24n * 60n * 60n;
  const info = {
    batchCode: "COCONUT-001",
    harvestGroupId: "HG-A01",
    farmLocation: "Ben Tre, Viet Nam",
    quantityKg: 1000n,
    harvestDate: now,
    expiryDate: now + THIRTY_DAYS,
  };
  const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const H_META = keccakId("metadata.json");
  const H_CERT = keccakId("certificate.pdf");
  const H_IMG = keccakId("batch.jpg");
  const H: [string, string, string] = [H_META, H_CERT, H_IMG];

  const txCreate = await contract.connect(farmer).createBatch(info, CID, H_META, H_CERT, H_IMG);
  await txCreate.wait();
  assert.equal(await contract.ownerOf(1n), farmer.address);
  console.log(`[2/7] createBatch OK tokenId=1 tx=${txCreate.hash}`);

  // 3. Farmer requestTransfer -> Logistics acceptTransfer
  const txReq1 = await contract.connect(farmer).requestTransfer(1n, logistics.address);
  await txReq1.wait();
  const pending1 = await contract.getPendingTransfer(1n);
  const txAcc1 = await contract.connect(logistics).acceptTransfer(1n, pending1.requestId, H);
  await txAcc1.wait();
  assert.equal(await contract.ownerOf(1n), logistics.address);
  const b1 = await contract.getBatch(1n);
  assert.equal(b1.lifecycle, 1n); // InTransit
  console.log(`[3/7] transfer Farmer -> Logistics OK tx=${txAcc1.hash}`);

  // 4. Logistics recordTransit
  const obsTime = BigInt(await networkHelpers.time.latest());
  const txTransit = await contract.connect(logistics).recordTransit(1n, 1n, 1000, obsTime, "10.77,106.70");
  await txTransit.wait();
  console.log(`[4/7] recordTransit OK readingId=1 temp=1000 tx=${txTransit.hash}`);

  // 5. Logistics requestTransfer -> Retailer acceptTransfer
  const txReq2 = await contract.connect(logistics).requestTransfer(1n, retailer.address);
  await txReq2.wait();
  const pending2 = await contract.getPendingTransfer(1n);
  const txAcc2 = await contract.connect(retailer).acceptTransfer(1n, pending2.requestId, H);
  await txAcc2.wait();
  assert.equal(await contract.ownerOf(1n), retailer.address);
  const b2 = await contract.getBatch(1n);
  assert.equal(b2.lifecycle, 2n); // Delivered
  console.log(`[5/7] transfer Logistics -> Retailer OK tx=${txAcc2.hash}`);

  // 6. Retailer markSold
  const txSold = await contract.connect(retailer).markSold(1n);
  await txSold.wait();
  const b3 = await contract.getBatch(1n);
  assert.equal(b3.lifecycle, 3n); // Sold
  console.log(`[6/7] markSold OK tx=${txSold.hash}`);

  // 7. Verify Transfer event logs
  const logs = await contract.queryFilter(contract.filters.Transfer(null, null, 1n));
  assert.equal(logs.length, 3);
  assert.equal(logs[0].args[0], ZeroAddress);
  assert.equal(logs[0].args[1], farmer.address);
  assert.equal(logs[1].args[0], farmer.address);
  assert.equal(logs[1].args[1], logistics.address);
  assert.equal(logs[2].args[0], logistics.address);
  assert.equal(logs[2].args[1], retailer.address);
  console.log(`[7/7] Transfer logs (3 records) verified OK`);

  console.log("SMOKE OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
