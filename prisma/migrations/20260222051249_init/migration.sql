-- CreateTable
CREATE TABLE "trades" (
    "id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "sector" TEXT NOT NULL DEFAULT 'Technology',
    "status" TEXT NOT NULL DEFAULT 'Running',
    "buy_price" DECIMAL(65,30) NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL,
    "sl" DECIMAL(65,30) NOT NULL,
    "target" DECIMAL(65,30),
    "buy_date" DATE NOT NULL,
    "reason" TEXT,
    "timing" TEXT,
    "image_url" TEXT,
    "chart_link" TEXT,
    "tags" TEXT,
    "exit_price" DECIMAL(65,30),
    "exit_date" DATE,
    "deployed" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipo_accounts" (
    "id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "holder_name" TEXT NOT NULL,
    "pan" TEXT,
    "demat_name" TEXT,
    "demat_provider" TEXT NOT NULL DEFAULT 'Zerodha',
    "demat_id" TEXT,
    "bank" TEXT,
    "upi_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Retail',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipo_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipo_records" (
    "id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "symbol" TEXT,
    "year" TEXT NOT NULL,
    "exchange" TEXT NOT NULL DEFAULT 'NSE + BSE',
    "sector" TEXT NOT NULL DEFAULT 'Technology',
    "ipo_price" DECIMAL(65,30) NOT NULL,
    "lot_size" DECIMAL(65,30),
    "lots_applied" DECIMAL(65,30),
    "allotted" TEXT NOT NULL DEFAULT 'Yes',
    "qty_allotted" DECIMAL(65,30),
    "amount_applied" DECIMAL(65,30),
    "amount_paid" DECIMAL(65,30),
    "listing_date" DATE,
    "listing_price" DECIMAL(65,30),
    "selling_price" DECIMAL(65,30),
    "selling_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'Sold on Listing',
    "account_id" BIGINT,
    "notes" TEXT,
    "gmp_at_apply" DECIMAL(65,30),
    "subscription_times" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipo_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital" (
    "user_id" TEXT NOT NULL,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 500000,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capital_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "ipo_records" ADD CONSTRAINT "ipo_records_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ipo_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
