-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "username" VARCHAR(100),
    "full_name" VARCHAR(255),
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_modules" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privileges" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "privileges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_privileges" (
    "id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "privilege_id" TEXT NOT NULL,

    CONSTRAINT "feature_privileges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_feature_privileges" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "privilege_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_feature_privileges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_feature_privileges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "privilege_id" TEXT NOT NULL,
    "is_allowed" BOOLEAN NOT NULL,
    "reason" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_feature_privileges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" VARCHAR(255) NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "modules_code_key" ON "modules"("code");

-- CreateIndex
CREATE INDEX "role_modules_role_id_idx" ON "role_modules"("role_id");

-- CreateIndex
CREATE INDEX "role_modules_module_id_idx" ON "role_modules"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_modules_role_id_module_id_key" ON "role_modules"("role_id", "module_id");

-- CreateIndex
CREATE INDEX "features_module_id_idx" ON "features"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "features_module_id_code_key" ON "features"("module_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "privileges_code_key" ON "privileges"("code");

-- CreateIndex
CREATE INDEX "feature_privileges_feature_id_idx" ON "feature_privileges"("feature_id");

-- CreateIndex
CREATE INDEX "feature_privileges_privilege_id_idx" ON "feature_privileges"("privilege_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_privileges_feature_id_privilege_id_key" ON "feature_privileges"("feature_id", "privilege_id");

-- CreateIndex
CREATE INDEX "role_feature_privileges_role_id_idx" ON "role_feature_privileges"("role_id");

-- CreateIndex
CREATE INDEX "role_feature_privileges_feature_id_idx" ON "role_feature_privileges"("feature_id");

-- CreateIndex
CREATE INDEX "role_feature_privileges_privilege_id_idx" ON "role_feature_privileges"("privilege_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_feature_privileges_role_id_feature_id_privilege_id_key" ON "role_feature_privileges"("role_id", "feature_id", "privilege_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "user_role_feature_privileges_user_id_idx" ON "user_role_feature_privileges"("user_id");

-- CreateIndex
CREATE INDEX "user_role_feature_privileges_role_id_idx" ON "user_role_feature_privileges"("role_id");

-- CreateIndex
CREATE INDEX "user_role_feature_privileges_feature_id_idx" ON "user_role_feature_privileges"("feature_id");

-- CreateIndex
CREATE INDEX "user_role_feature_privileges_privilege_id_idx" ON "user_role_feature_privileges"("privilege_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_feature_privileges_user_id_role_id_feature_id_pri_key" ON "user_role_feature_privileges"("user_id", "role_id", "feature_id", "privilege_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_id_key" ON "user_sessions"("session_id");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- AddForeignKey
ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_privileges" ADD CONSTRAINT "feature_privileges_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_privileges" ADD CONSTRAINT "feature_privileges_privilege_id_fkey" FOREIGN KEY ("privilege_id") REFERENCES "privileges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_feature_privileges" ADD CONSTRAINT "role_feature_privileges_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_feature_privileges" ADD CONSTRAINT "role_feature_privileges_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_feature_privileges" ADD CONSTRAINT "role_feature_privileges_privilege_id_fkey" FOREIGN KEY ("privilege_id") REFERENCES "privileges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_feature_privileges" ADD CONSTRAINT "user_role_feature_privileges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_feature_privileges" ADD CONSTRAINT "user_role_feature_privileges_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_feature_privileges" ADD CONSTRAINT "user_role_feature_privileges_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_feature_privileges" ADD CONSTRAINT "user_role_feature_privileges_privilege_id_fkey" FOREIGN KEY ("privilege_id") REFERENCES "privileges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
