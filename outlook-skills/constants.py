"""
Shared keychain constants for auth_runner.py and token_helper.py.
Both files use these keys to read/write the OS keychain — any rename here
propagates to both sides without silent mismatch.
"""

KEYCHAIN_SERVICE             = "azure-skills-auth"
KEYCHAIN_USER_ENCRYPTION_KEY = "token-encryption-key"
KEYCHAIN_USER_CLIENT_SECRET  = "client-secret"
