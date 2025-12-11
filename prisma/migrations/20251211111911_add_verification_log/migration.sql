-- CreateTable
CREATE TABLE `VerificationLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ijazahId` INTEGER NOT NULL,
    `verifierType` ENUM('MAHASISWA', 'PERUSAHAAN', 'ADMIN', 'SYSTEM') NOT NULL,
    `verifierInfo` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VerificationLog` ADD CONSTRAINT `VerificationLog_ijazahId_fkey` FOREIGN KEY (`ijazahId`) REFERENCES `Ijazah`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
