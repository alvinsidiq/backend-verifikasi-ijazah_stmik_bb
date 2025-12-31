-- AlterTable
ALTER TABLE `Mahasiswa` ADD COLUMN `alamat` VARCHAR(191) NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `foto` VARCHAR(191) NULL,
    ADD COLUMN `noTelepon` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `BlockchainRecord_ijazahHash_key` ON `BlockchainRecord`(`ijazahHash`);

