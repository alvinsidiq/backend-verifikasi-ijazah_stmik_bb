-- CreateTable
CREATE TABLE `Ijazah` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mahasiswaId` INTEGER NOT NULL,
    `nomorIjazah` VARCHAR(191) NOT NULL,
    `tanggalLulus` DATETIME(3) NOT NULL,
    `fileUrl` VARCHAR(191) NULL,
    `statusValidasi` ENUM('DRAFT', 'MENUNGGU', 'TERVALIDASI', 'DITOLAK') NOT NULL DEFAULT 'DRAFT',
    `validatorId` INTEGER NULL,
    `catatanValidasi` VARCHAR(191) NULL,
    `validatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Ijazah_nomorIjazah_key`(`nomorIjazah`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Ijazah` ADD CONSTRAINT `Ijazah_mahasiswaId_fkey` FOREIGN KEY (`mahasiswaId`) REFERENCES `Mahasiswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ijazah` ADD CONSTRAINT `Ijazah_validatorId_fkey` FOREIGN KEY (`validatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
