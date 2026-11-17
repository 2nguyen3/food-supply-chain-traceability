import { expect } from "chai";
import hre, { network } from "hardhat";
import { readFileSync } from "node:fs";
import FoodTraceabilityModule from "../ignition/modules/FoodTraceability.js";

// Việc P03-16: Ignition module và ABI xuất cho BE, FE, IoT.
const { ethers, ignition } = await network.create();

describe("P03-16: Ignition module FoodTraceability", function () {
  it("triển khai được; ví deploy là Admin; tên và ký hiệu NFT đúng", async function () {
    const [deployer, other] = await ethers.getSigners();
    const { foodTraceability } = await ignition.deploy(FoodTraceabilityModule);
    const adminRole = await foodTraceability.DEFAULT_ADMIN_ROLE();
    expect(await foodTraceability.hasRole(adminRole, deployer.address)).to.equal(true);
    expect(await foodTraceability.hasRole(adminRole, other.address)).to.equal(false);
    expect(await foodTraceability.name()).to.equal("Food Traceability Batch");
    expect(await foodTraceability.symbol()).to.equal("FTB");
  });
});

describe("P03-16: ABI xuất ra contracts/abi/FoodTraceability.json", function () {
  const file = JSON.parse(readFileSync(new URL("../abi/FoodTraceability.json", import.meta.url), "utf8"));

  it("có contractName và abi, abi khớp artifact vừa biên dịch", async function () {
    const artifact = await hre.artifacts.readArtifact("FoodTraceability");
    expect(file.contractName).to.equal("FoodTraceability");
    expect(file.abi).to.deep.equal(artifact.abi);
  });

  it("chứa đủ hàm, event và lỗi mà BE, FE, IoT dùng", async function () {
    const names = (type: string) => new Set(file.abi.filter((x: any) => x.type === type).map((x: any) => x.name));
    const fns = names("function");
    for (const n of [
      "assignFarmer", "createBatch", "getBatch", "getTokenIdByCode", "getPendingTransfer", "isExpired",
      "requestTransfer", "acceptTransfer", "rejectTransfer", "cancelTransfer",
      "recordTransit", "markSold", "reportIncident", "getIncident", "recallBatch",
      "hasRole", "ownerOf", "tokenURI", "farmIdOf",
    ]) expect(fns.has(n), `thiếu hàm ${n}`).to.equal(true);
    const evs = names("event");
    for (const n of [
      "BatchCreated", "TransferRequested", "TransferAccepted", "TransferRejected", "TransferCancelled",
      "TransitRecorded", "BatchSold", "IncidentReported", "BatchRecalled", "FarmerAssigned", "Transfer",
    ]) expect(evs.has(n), `thiếu event ${n}`).to.equal(true);
    const errs = names("error");
    for (const n of ["BatchLocked", "HashMismatch", "DirectTransferDisabled", "NotTokenOwner"]) {
      expect(errs.has(n), `thiếu lỗi ${n}`).to.equal(true);
    }
  });
});
