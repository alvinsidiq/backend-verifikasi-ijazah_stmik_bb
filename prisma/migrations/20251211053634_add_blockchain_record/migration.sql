-- CreateTable
CREATE TABLE `BlockchainRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ijazahId` INTEGER NOT NULL,
    `ijazahHash` VARCHAR(191) NOT NULL,
    `contractAddress` VARCHAR(191) NULL,
    `network` VARCHAR(191) NOT NULL,
    `txHash` VARCHAR(191) NULL,
    `blockNumber` INTEGER NULL,
    `statusOnchain` ENUM('DUMMY', 'PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'DUMMY',
    `explorerUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BlockchainRecord_ijazahId_key`(`ijazahId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BlockchainRecord` ADD CONSTRAINT `BlockchainRecord_ijazahId_fkey` FOREIGN KEY (`ijazahId`) REFERENCES `Ijazah`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
