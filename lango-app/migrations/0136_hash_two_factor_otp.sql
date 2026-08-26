-- 0136_hash_two_factor_otp.sql
-- M-1: Widen two_factor_otps.otp column to store SHA-256 hashes instead of plaintext codes
ALTER TABLE IF EXISTS two_factor_otps ALTER COLUMN otp TYPE varchar(255);
