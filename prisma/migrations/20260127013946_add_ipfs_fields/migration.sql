-- AlterTable
ALTER TABLE `BlockchainRecord` ADD COLUMN `chainId` INTEGER NULL,
    ADD COLUMN `errorMessage` VARCHAR(191) NULL,
    ADD COLUMN `nomorIjazahHash` VARCHAR(191) NULL,
    ADD COLUMN `publishedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Ijazah` ADD COLUMN `ipfsCid` VARCHAR(191) NULL,
    ADD COLUMN `ipfsError` VARCHAR(191) NULL,
    ADD COLUMN `ipfsGatewayUrl` VARCHAR(191) NULL,
    ADD COLUMN `ipfsStatus` ENUM('NOT_UPLOADED', 'UPLOADING', 'READY', 'FAILED') NOT NULL DEFAULT 'NOT_UPLOADED',
    ADD COLUMN `ipfsUploadedAt` DATETIME(3) NULL,
    ADD COLUMN `ipfsUri` VARCHAR(191) NULL,
    ADD COLUMN `nomorIjazahHash` VARCHAR(191) NULL,
    ADD COLUMN `pdfSha256` VARCHAR(191) NULL,
    ADD COLUMN `pdfSizeBytes` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Ijazah_nomorIjazahHash_key` ON `Ijazah`(`nomorIjazahHash`);
