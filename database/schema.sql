CREATE DATABASE IF NOT EXISTS moneymate
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE moneymate;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  color CHAR(7) NOT NULL DEFAULT '#007C78',
  PRIMARY KEY (id),
  UNIQUE KEY uk_categories_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  raw_description VARCHAR(500) NOT NULL,
  cleaned_description VARCHAR(500) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  txn_date DATE NOT NULL,
  category_id BIGINT NULL,
  confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0,
  dedupe_hash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unverified',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transactions_user_date (user_id, txn_date),
  KEY idx_transactions_user_status (user_id, status),
  KEY idx_transactions_category_date (category_id, txn_date),
  UNIQUE KEY uk_transactions_dedupe_hash (dedupe_hash),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_transactions_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT chk_transactions_amount CHECK (amount >= 0),
  CONSTRAINT chk_transactions_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS budgets (
  user_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  `limit` DECIMAL(14,2) NOT NULL,
  period VARCHAR(20) NOT NULL DEFAULT 'monthly',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, category_id),
  KEY idx_budgets_category (category_id),
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT chk_budgets_limit CHECK (`limit` > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS goals (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(120) NOT NULL,
  target_amount DECIMAL(14,2) NOT NULL,
  saved_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  target_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_goals_user (user_id),
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_goals_target CHECK (target_amount > 0),
  CONSTRAINT chk_goals_saved CHECK (saved_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS badges (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_badges_user_name (user_id, name),
  KEY idx_badges_user (user_id),
  CONSTRAINT fk_badges_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
