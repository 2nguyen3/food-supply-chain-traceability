import { expect } from "chai";
import { network } from "hardhat";
import { ZeroAddress, ZeroHash, id as keccakId } from "ethers";

// Việc P03-02, P03-03, P03-04 và test C01–C03 (P03-12).
// Chỉ dùng ví thử nghiệm có sẵn của Hardhat (trong bộ nhớ), không có khóa thật.
const { ethers, networkHelpers } = await network.create();

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const H_META = keccakId("metadata.json");
const H_CERT = keccakId("certificate.pdf");
const H_IMG = keccakId("batch.jpg");

async function deployFixture() {
  const [admin, farmerA, farmerB, logistics, retailer, stranger, farmerC] = await ethers.getSigners();
  const contract = await ethers.deployContract("FoodTraceability");
  const FARMER_ROLE = await contract.FARMER_ROLE();
  const LOGISTICS_ROLE = await contract.LOGISTICS_ROLE();
  const RETAILER_ROLE = await contract.RETAILER_ROLE();
  await contract.connect(admin).assignFarmer(farmerA.address, "FARM-A");
  await contract.connect(admin).assignFarmer(farmerB.address, "FARM-B");
  await contract.connect(admin).grantRole(LOGISTICS_ROLE, logistics.address);
  await contract.connect(admin).grantRole(RETAILER_ROLE, retailer.address);
  return { contract, admin, farmerA, farmerB, logistics, retailer, stranger, farmerC, FARMER_ROLE, LOGISTICS_ROLE, RETAILER_ROLE };
}

// Thông tin lô hợp lệ; harvestDate = thời điểm block gần nhất (<= now), expiryDate = +30 ngày.
async function validInfo(overrides: Record<string, unknown> = {}) {
  const now = Number(await networkHelpers.time.latest());
  return {
    batchCode: "COCONUT-001",
    harvestGroupId: "HG-A01",
    farmLocation: "Ben Tre, Viet Nam",
    quantityKg: 1000n,
    harvestDate: BigInt(now),
    expiryDate: BigInt(now + THIRTY_DAYS),
    ...overrides,
  };
}

type Fx = Awaited<ReturnType<typeof deployFixture>>;
type Info = Awaited<ReturnType<typeof validInfo>>;

function create(
  fx: Fx,
  info: Info,
  opts: { cid?: string; meta?: string; cert?: string; img?: string; from?: Fx["farmerA"] } = {},
) {
  return fx.contract
    .connect(opts.from ?? fx.farmerA)
    .createBatch(info, opts.cid ?? CID, opts.meta ?? H_META, opts.cert ?? H_CERT, opts.img ?? H_IMG);
}

async function expectNoBatchMinted(fx: Fx, expectedCount: bigint) {
  // Chưa có lô nào hoặc đúng số lô đã có: tokenId kế tiếp không tồn tại.
  await expect(fx.contract.ownerOf(expectedCount + 1n)).to.be.revertedWithCustomError(
    fx.contract,
    "ERC721NonexistentToken",
  );
}

describe("P03-02: FoodTraceability là ERC-721 có phân quyền", function () {
  it("hỗ trợ ERC-165, ERC-721, ERC-721 Metadata và AccessControl", async function () {
    const { contract } = await networkHelpers.loadFixture(deployFixture);
    expect(await contract.supportsInterface("0x01ffc9a7")).to.equal(true); // ERC-165
    expect(await contract.supportsInterface("0x80ac58cd")).to.equal(true); // ERC-721
    expect(await contract.supportsInterface("0x5b5e139f")).to.equal(true); // ERC-721 Metadata
    expect(await contract.supportsInterface("0x7965db0b")).to.equal(true); // AccessControl
    expect(await contract.supportsInterface("0xffffffff")).to.equal(false);
  });
});

describe("P03-03: vai trò và gán Farmer/farmId", function () {
  it("ADMIN_ROLE là DEFAULT_ADMIN_ROLE; các role khác là keccak256 của tên; ví deploy là Admin", async function () {
    const { contract, admin, FARMER_ROLE, LOGISTICS_ROLE, RETAILER_ROLE } = await networkHelpers.loadFixture(deployFixture);
    const ADMIN_ROLE = await contract.ADMIN_ROLE();
    expect(ADMIN_ROLE).to.equal(await contract.DEFAULT_ADMIN_ROLE());
    expect(ADMIN_ROLE).to.equal(ZeroHash);
    expect(FARMER_ROLE).to.equal(keccakId("FARMER_ROLE"));
    expect(LOGISTICS_ROLE).to.equal(keccakId("LOGISTICS_ROLE"));
    expect(RETAILER_ROLE).to.equal(keccakId("RETAILER_ROLE"));
    expect(await contract.hasRole(ADMIN_ROLE, admin.address)).to.equal(true);
  });

  it("Admin gán Farmer: cấp FARMER_ROLE, lưu farmId, phát FarmerAssigned và RoleGranted", async function () {
    const { contract, admin, farmerC, FARMER_ROLE } = await networkHelpers.loadFixture(deployFixture);
    const tx = contract.connect(admin).assignFarmer(farmerC.address, "FARM-C");
    await expect(tx).to.emit(contract, "FarmerAssigned").withArgs(farmerC.address, "FARM-C");
    await expect(tx).to.emit(contract, "RoleGranted").withArgs(FARMER_ROLE, farmerC.address, admin.address);
    expect(await contract.farmIdOf(farmerC.address)).to.equal("FARM-C");
    expect(await contract.hasRole(FARMER_ROLE, farmerC.address)).to.equal(true);
  });

  it("người không phải Admin không được gán Farmer hay cấp role", async function () {
    const { contract, farmerA, stranger, farmerC, FARMER_ROLE } = await networkHelpers.loadFixture(deployFixture);
    const ADMIN_ROLE = await contract.ADMIN_ROLE();
    for (const caller of [stranger, farmerA]) {
      await expect(contract.connect(caller).assignFarmer(farmerC.address, "FARM-C"))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
        .withArgs(caller.address, ADMIN_ROLE);
      await expect(contract.connect(caller).grantRole(FARMER_ROLE, farmerC.address))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
        .withArgs(caller.address, ADMIN_ROLE);
    }
    expect(await contract.farmIdOf(farmerC.address)).to.equal("");
  });

  it("từ chối địa chỉ 0 và farmId rỗng", async function () {
    const { contract, admin, farmerC } = await networkHelpers.loadFixture(deployFixture);
    await expect(contract.connect(admin).assignFarmer(ZeroAddress, "FARM-C")).to.be.revertedWithCustomError(contract, "ZeroAddress");
    await expect(contract.connect(admin).assignFarmer(farmerC.address, "")).to.be.revertedWithCustomError(contract, "EmptyFarmId");
  });

  it("Admin thu hồi vai trò: phát RoleRevoked và Farmer không tạo lô được nữa", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const { contract, admin, farmerA, FARMER_ROLE } = fx;
    await expect(contract.connect(admin).revokeRole(FARMER_ROLE, farmerA.address))
      .to.emit(contract, "RoleRevoked")
      .withArgs(FARMER_ROLE, farmerA.address, admin.address);
    await expect(create(fx, await validInfo()))
      .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
      .withArgs(farmerA.address, FARMER_ROLE);
  });
});

describe("C01: Farmer tạo lô hợp lệ", function () {
  it("mint NFT, đặt tokenURI, lưu đủ dữ liệu lô và phát event", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const { contract, farmerA } = fx;
    const info = await validInfo();

    const tx = create(fx, info);
    await expect(tx)
      .to.emit(contract, "BatchCreated")
      .withArgs(1n, farmerA.address, "FARM-A", "HG-A01", "COCONUT-001", info.harvestDate, CID, H_META);
    await expect(tx).to.emit(contract, "Transfer").withArgs(ZeroAddress, farmerA.address, 1n);

    expect(await contract.ownerOf(1n)).to.equal(farmerA.address);
    expect(await contract.balanceOf(farmerA.address)).to.equal(1n);
    expect(await contract.tokenURI(1n)).to.equal(`ipfs://${CID}`);
    expect(await contract.getTokenIdByCode("COCONUT-001")).to.equal(1n);

    const b = await contract.getBatch(1n);
    expect(b.tokenId).to.equal(1n);
    expect(b.batchCode).to.equal("COCONUT-001");
    expect(b.farmId).to.equal("FARM-A");
    expect(b.farmLocation).to.equal("Ben Tre, Viet Nam");
    expect(b.harvestGroupId).to.equal("HG-A01");
    expect(b.quantityKg).to.equal(1000n);
    expect(b.harvestDate).to.equal(info.harvestDate);
    expect(b.expiryDate).to.equal(info.expiryDate);
    expect(b.lifecycle).to.equal(0n); // Created
    expect(b.recalled).to.equal(false);
    expect(b.metadataHash).to.equal(H_META);
    expect(b.certificateHash).to.equal(H_CERT);
    expect(b.imageHash).to.equal(H_IMG);
  });

  it("tokenId bắt đầu từ 1 và tăng dần; mỗi Farmer dùng farmId của mình", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const { contract, farmerA, farmerB } = fx;
    await create(fx, await validInfo());
    await expect(create(fx, await validInfo({ batchCode: "COCONUT-004", harvestGroupId: "HG-B01" }), { from: farmerB }))
      .to.emit(contract, "BatchCreated");
    expect(await contract.ownerOf(1n)).to.equal(farmerA.address);
    expect(await contract.ownerOf(2n)).to.equal(farmerB.address);
    expect((await contract.getBatch(2n)).farmId).to.equal("FARM-B");
    expect(await contract.getTokenIdByCode("COCONUT-004")).to.equal(2n);
    expect(await contract.getTokenIdByCode("KHONG-TON-TAI")).to.equal(0n);
  });
});

describe("C02: tạo lô sai role, farmId hoặc trùng mã", function () {
  it("người không có FARMER_ROLE bị chặn (người lạ và vai trò khác)", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const { contract, stranger, logistics, retailer, FARMER_ROLE } = fx;
    for (const caller of [stranger, logistics, retailer]) {
      await expect(create(fx, await validInfo(), { from: caller }))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
        .withArgs(caller.address, FARMER_ROLE);
    }
    await expectNoBatchMinted(fx, 0n);
  });

  it("FARMER_ROLE nhưng Admin chưa gán farmId thì bị chặn", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const { contract, admin, farmerC, FARMER_ROLE } = fx;
    await contract.connect(admin).grantRole(FARMER_ROLE, farmerC.address); // cố ý không qua assignFarmer
    await expect(create(fx, await validInfo(), { from: farmerC }))
      .to.be.revertedWithCustomError(contract, "FarmNotAssigned")
      .withArgs(farmerC.address);
    await expectNoBatchMinted(fx, 0n);
  });

  it("trùng mã lô bị chặn, kể cả khi do Farmer khác tạo", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const { contract, farmerA, farmerB } = fx;
    await create(fx, await validInfo());
    for (const caller of [farmerA, farmerB]) {
      await expect(create(fx, await validInfo(), { from: caller }))
        .to.be.revertedWithCustomError(contract, "DuplicateBatchCode")
        .withArgs("COCONUT-001");
    }
    expect(await contract.getTokenIdByCode("COCONUT-001")).to.equal(1n);
    expect(await contract.balanceOf(farmerA.address)).to.equal(1n);
    await expectNoBatchMinted(fx, 1n);
  });
});

describe("C03: số lượng, ngày, metadata sai", function () {
  it("quantityKg khác 1000 (0, 999, 1001) bị chặn", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    for (const q of [0n, 999n, 1001n]) {
      await expect(create(fx, await validInfo({ quantityKg: q })))
        .to.be.revertedWithCustomError(fx.contract, "InvalidQuantity")
        .withArgs(q);
    }
    await expectNoBatchMinted(fx, 0n);
  });

  it("ngày không hợp lệ bị chặn: hết hạn trước hoặc bằng thời điểm hiện tại, hoặc thu hoạch trong tương lai", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const now = Number(await networkHelpers.time.latest());
    const cases: Array<Record<string, bigint>> = [
      { harvestDate: BigInt(now - 100), expiryDate: BigInt(now - 50) }, // hết hạn trong quá khứ
      { harvestDate: BigInt(now - 100), expiryDate: BigInt(now) }, // hết hạn bằng block gần nhất (<= now)
      { harvestDate: BigInt(now - 100), expiryDate: BigInt(now - 100) }, // hết hạn bằng ngày thu hoạch
      { harvestDate: BigInt(now + 3600), expiryDate: BigInt(now + THIRTY_DAYS) }, // thu hoạch trong tương lai
    ];
    for (const c of cases) {
      await expect(create(fx, await validInfo(c)))
        .to.be.revertedWithCustomError(fx.contract, "InvalidDates")
        .withArgs(c.harvestDate, c.expiryDate);
    }
    await expectNoBatchMinted(fx, 0n);
  });

  it("hết hạn đúng bằng thời điểm block thực thi vẫn bị chặn (expiryDate phải lớn hơn now)", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const t = Number(await networkHelpers.time.latest()) + 1000;
    await networkHelpers.time.setNextBlockTimestamp(t);
    const info = await validInfo({ harvestDate: BigInt(t - 10), expiryDate: BigInt(t) });
    await expect(create(fx, info)).to.be.revertedWithCustomError(fx.contract, "InvalidDates");
    await expectNoBatchMinted(fx, 0n);
  });

  it("mã lô rỗng bị chặn", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    await expect(create(fx, await validInfo({ batchCode: "" }))).to.be.revertedWithCustomError(fx.contract, "EmptyBatchCode");
    await expectNoBatchMinted(fx, 0n);
  });

  it("metadata thiếu bị chặn: CID rỗng hoặc một trong ba hash bằng 0", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const info = await validInfo();
    await expect(create(fx, info, { cid: "" })).to.be.revertedWithCustomError(fx.contract, "EmptyMetadata");
    await expect(create(fx, info, { meta: ZeroHash })).to.be.revertedWithCustomError(fx.contract, "EmptyMetadata");
    await expect(create(fx, info, { cert: ZeroHash })).to.be.revertedWithCustomError(fx.contract, "EmptyMetadata");
    await expect(create(fx, info, { img: ZeroHash })).to.be.revertedWithCustomError(fx.contract, "EmptyMetadata");
    await expectNoBatchMinted(fx, 0n);
  });

  it("lô sai không phát BatchCreated và không làm tăng tokenId kế tiếp", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const { contract } = fx;
    await expect(create(fx, await validInfo({ quantityKg: 999n }))).to.be.revertedWithCustomError(contract, "InvalidQuantity");
    const info = await validInfo();
    await expect(create(fx, info))
      .to.emit(contract, "BatchCreated")
      .withArgs(1n, fx.farmerA.address, "FARM-A", "HG-A01", "COCONUT-001", info.harvestDate, CID, H_META);
  });
});
