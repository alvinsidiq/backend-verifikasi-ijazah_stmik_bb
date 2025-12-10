-- CreateTable
CREATE TABLE `ProgramStudi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kodeProdi` VARCHAR(191) NOT NULL,
    `namaProdi` VARCHAR(191) NOT NULL,
    `jenjang` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProgramStudi_kodeProdi_key`(`kodeProdi`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
