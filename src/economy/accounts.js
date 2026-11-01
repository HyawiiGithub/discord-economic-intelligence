'use strict';

const db = require('../db');
const { nowIso } = require('../money');

function acct(guildId, ownerType, ownerId, kind) {
    return db.ensureAccount(guildId, ownerType, ownerId, kind);
}
function walletEntry(guildId, userId, delta) {
    return { accountId: acct(guildId, 'user', userId, 'wallet').id, delta };
}
function depositEntry(guildId, userId, delta) {
    return { accountId: acct(guildId, 'user', userId, 'deposit').id, delta };
}
function loanEntry(guildId, userId, delta) {
    return { accountId: acct(guildId, 'user', userId, 'loan').id, delta };
}
function companyEntry(guildId, companyId, kind, delta) {
    return { accountId: acct(guildId, 'company', String(companyId), kind).id, delta };
}
function governmentEntry(guildId, delta) {
    return { accountId: acct(guildId, 'government', 'treasury', 'treasury').id, delta };
}
function bankEntry(guildId, kind, delta) {
    return { accountId: acct(guildId, 'institution', 'state_bank', kind).id, delta };
}
function centralEntry(guildId, kind, delta) {
    return { accountId: acct(guildId, 'central_bank', 'central', kind).id, delta };
}
function systemEntry(guildId, kind, delta) {
    return { accountId: acct(guildId, 'system', 'market', kind).id, delta };
}
function ensureUser(guildId, userId, displayName) {
    const profile = db.ensureProfile(guildId, userId, displayName);
    const accounts = db.ensureUserAccounts(guildId, userId);
    if (!profile.starter_granted) {
        const guild = db.getGuild(guildId);
        const amount = Math.max(0, Number(guild.starter_balance) || 0);
        if (amount > 0) {
            db.post(guildId, 'starter_balance', userId, 'Initial household endowment', [
                walletEntry(guildId, userId, amount),
                centralEntry(guildId, 'currency_issued', -amount),
            ]);
        }
        db.run('UPDATE profiles SET starter_granted = 1, updated_at = ? WHERE guild_id = ? AND user_id = ?',
            [nowIso(), guildId, String(userId)]);
    }
    return { profile: db.get('SELECT * FROM profiles WHERE guild_id = ? AND user_id = ?', [guildId, String(userId)]), accounts };
}
function mint(guildId, userId, amount, memo, actorId) {
    const value = Math.trunc(Number(amount) || 0);
    if (value <= 0) throw new Error('mint amount must be positive');
    db.post(guildId, 'currency_issue', actorId, memo || 'Currency issue', [
        walletEntry(guildId, userId, value),
        centralEntry(guildId, 'currency_issued', -value),
    ]);
}
function burn(guildId, userId, amount, memo, actorId) {
    const value = Math.trunc(Number(amount) || 0);
    if (value <= 0) throw new Error('burn amount must be positive');
    if (db.walletBalance(guildId, userId) < value) throw new Error('insufficient wallet balance');
    db.post(guildId, 'currency_withdrawal', actorId, memo || 'Currency withdrawal', [
        walletEntry(guildId, userId, -value),
        centralEntry(guildId, 'currency_issued', value),
    ]);
}
function pay(guildId, fromUserId, toUserId, amount, memo, actorId) {
    const value = Math.trunc(Number(amount) || 0);
    if (value <= 0) throw new Error('payment must be positive');
    if (String(fromUserId) === String(toUserId)) throw new Error('cannot pay yourself');
    if (db.walletBalance(guildId, fromUserId) < value) throw new Error('insufficient wallet balance');
    db.post(guildId, 'payment', actorId || fromUserId, memo || 'Peer payment', [
        walletEntry(guildId, fromUserId, -value),
        walletEntry(guildId, toUserId, value),
    ]);
}
function depositToBank(guildId, userId, amount) {
    const value = Math.trunc(Number(amount) || 0);
    if (value <= 0) throw new Error('deposit must be positive');
    if (db.walletBalance(guildId, userId) < value) throw new Error('insufficient wallet balance');
    db.post(guildId, 'bank_deposit', userId, 'Cash deposit', [
        walletEntry(guildId, userId, -value),
        bankEntry(guildId, 'vault', value),
        depositEntry(guildId, userId, value),
        bankEntry(guildId, 'deposit_liability', -value),
    ]);
}
function withdrawFromBank(guildId, userId, amount) {
    const value = Math.trunc(Number(amount) || 0);
    if (value <= 0) throw new Error('withdrawal must be positive');
    if (db.depositBalance(guildId, userId) < value) throw new Error('insufficient deposit balance');
    const vault = db.balanceOf(guildId, 'institution', 'state_bank', 'vault');
    if (vault < value) throw new Error('the bank has insufficient cash reserves');
    db.post(guildId, 'bank_withdrawal', userId, 'Cash withdrawal', [
        depositEntry(guildId, userId, -value),
        bankEntry(guildId, 'deposit_liability', value),
        bankEntry(guildId, 'vault', -value),
        walletEntry(guildId, userId, value),
    ]);
}
function disburseLoan(guildId, borrowerType, borrowerId, principal, actorId) {
    const value = Math.trunc(Number(principal) || 0);
    if (value <= 0) throw new Error('loan principal must be positive');
    const vault = db.balanceOf(guildId, 'institution', 'state_bank', 'vault');
    if (vault < value) throw new Error('the bank has insufficient loanable reserves');
    const borrowerKind = borrowerType === 'company' ? 'loan' : 'loan';
    const wallet = borrowerType === 'company'
        ? companyEntry(guildId, borrowerId, 'cash', value)
        : walletEntry(guildId, borrowerId, value);
    const liability = borrowerType === 'company'
        ? companyEntry(guildId, borrowerId, borrowerKind, -value)
        : loanEntry(guildId, borrowerId, -value);
    db.post(guildId, 'loan_disbursement', actorId || borrowerId, 'Loan disbursement', [
        wallet,
        liability,
        bankEntry(guildId, 'vault', -value),
        bankEntry(guildId, 'loan_asset', value),
    ]);
}
function repayLoan(guildId, borrowerType, borrowerId, principalPart, interestPart, actorId) {
    const principal = Math.max(0, Math.trunc(Number(principalPart) || 0));
    const interest = Math.max(0, Math.trunc(Number(interestPart) || 0));
    const total = principal + interest;
    if (total <= 0) throw new Error('repayment must be positive');
    if (borrowerType === 'company') {
        const cash = db.balanceOf(guildId, 'company', String(borrowerId), 'cash');
        if (cash < total) throw new Error('company has insufficient cash');
    } else if (db.walletBalance(guildId, borrowerId) < total) {
        throw new Error('insufficient wallet balance');
    }
    const entries = [];
    if (borrowerType === 'company') {
        entries.push(companyEntry(guildId, borrowerId, 'cash', -total));
        entries.push(companyEntry(guildId, borrowerId, 'loan', total));
    } else {
        entries.push(walletEntry(guildId, borrowerId, -total));
        entries.push(loanEntry(guildId, borrowerId, total));
    }
    entries.push(bankEntry(guildId, 'loan_asset', -total));
    entries.push(bankEntry(guildId, 'vault', total));
    db.post(guildId, 'loan_repayment', actorId || borrowerId, 'Loan repayment', entries);
}
function accrueLoanInterest(guildId, borrowerType, borrowerId, interest, actorId) {
    const value = Math.max(0, Math.trunc(Number(interest) || 0));
    if (!value) return;
    const entries = borrowerType === 'company'
        ? [companyEntry(guildId, borrowerId, 'loan', -value)]
        : [loanEntry(guildId, borrowerId, -value)];
    entries.push(bankEntry(guildId, 'loan_asset', value));
    db.post(guildId, 'loan_interest_accrual', actorId || borrowerId, 'Interest accrued', entries);
}
function accrueDepositInterest(guildId, userId, interest) {
    const value = Math.max(0, Math.trunc(Number(interest) || 0));
    if (!value) return;
    db.post(guildId, 'deposit_interest', userId, 'Deposit interest', [
        depositEntry(guildId, userId, value),
        bankEntry(guildId, 'interest_expense', -value),
    ]);
}
function collectTax(guildId, userId, amount, kind, actorId) {
    const value = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!value) return;
    if (db.walletBalance(guildId, userId) < value) throw new Error('insufficient wallet balance for tax');
    db.post(guildId, kind || 'tax', actorId || userId, 'Tax collected', [
        walletEntry(guildId, userId, -value),
        governmentEntry(guildId, value),
    ]);
}
function companyToGovernment(guildId, companyId, amount, kind, actorId) {
    const value = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!value) return;
    db.post(guildId, kind || 'company_tax', actorId || companyId, 'Company tax', [
        companyEntry(guildId, companyId, 'cash', -value),
        governmentEntry(guildId, value),
    ]);
}
function governmentToWallet(guildId, userId, amount, kind, actorId) {
    const value = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!value) return;
    if (db.balanceOf(guildId, 'government', 'treasury', 'treasury') < value) throw new Error('treasury has insufficient funds');
    db.post(guildId, kind || 'government_spending', actorId || 'government', 'Government payment', [
        governmentEntry(guildId, -value),
        walletEntry(guildId, userId, value),
    ]);
}
function walletToCompany(guildId, userId, companyId, amount, kind, actorId) {
    const value = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!value) return;
    if (db.walletBalance(guildId, userId) < value) throw new Error('insufficient wallet balance');
    db.post(guildId, kind || 'company_payment', actorId || userId, 'Payment to company', [
        walletEntry(guildId, userId, -value),
        companyEntry(guildId, companyId, 'cash', value),
    ]);
}
function companyToWallet(guildId, companyId, userId, amount, kind, actorId) {
    const value = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!value) return;
    if (db.balanceOf(guildId, 'company', String(companyId), 'cash') < value) throw new Error('company has insufficient cash');
    db.post(guildId, kind || 'company_payout', actorId || userId, 'Company payout', [
        companyEntry(guildId, companyId, 'cash', -value),
        walletEntry(guildId, userId, value),
    ]);
}
function treasuryBalance(guildId) {
    return db.balanceOf(guildId, 'government', 'treasury', 'treasury');
}
function bankVault(guildId) {
    return db.balanceOf(guildId, 'institution', 'state_bank', 'vault');
}
function bankDeposits(guildId) {
    return -db.balanceOf(guildId, 'institution', 'state_bank', 'deposit_liability');
}
function bankLoanAssets(guildId) {
    return db.balanceOf(guildId, 'institution', 'state_bank', 'loan_asset');
}
function moneySupply(guildId) {
    const row = db.get(`SELECT
        COALESCE(SUM(CASE WHEN owner_type = 'user' AND kind = 'wallet' THEN balance ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN owner_type = 'user' AND kind = 'deposit' THEN balance ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN owner_type = 'company' AND kind = 'cash' THEN balance ELSE 0 END), 0) AS total
        FROM accounts WHERE guild_id = ?`, [guildId]);
    return Number(row && row.total) || 0;
}

module.exports = {
    acct,
    walletEntry,
    depositEntry,
    loanEntry,
    companyEntry,
    governmentEntry,
    bankEntry,
    centralEntry,
    systemEntry,
    ensureUser,
    mint,
    burn,
    pay,
    depositToBank,
    withdrawFromBank,
    disburseLoan,
    repayLoan,
    accrueLoanInterest,
    accrueDepositInterest,
    collectTax,
    companyToGovernment,
    governmentToWallet,
    walletToCompany,
    companyToWallet,
    treasuryBalance,
    bankVault,
    bankDeposits,
    bankLoanAssets,
    moneySupply,
};
