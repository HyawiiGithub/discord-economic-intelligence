'use strict';

const db = require('../db');
const accounts = require('./accounts');
const { nowIso, addMinutes, formatBps, safeDiv, round } = require('../money');

function policyRateBps(guildId) {
    return Number(db.getGuild(guildId).policy_rate_bps) || 0;
}
function reserveRequirement(guildId) {
    return Number(db.getGuild(guildId).reserve_ratio_bps) || 0;
}
function depositRateBps(guildId) {
    const policy = policyRateBps(guildId);
    return Math.max(0, Math.round(policy * 0.45) - 25);
}
function debtTotal(guildId, userId) {
    return db.loanBalance(guildId, 'user', userId);
}
function creditScore(guildId, userId) {
    const profile = db.ensureProfile(guildId, userId);
    const wallet = db.walletBalance(guildId, userId);
    const deposit = db.depositBalance(guildId, userId);
    const debt = debtTotal(guildId, userId);
    const assets = wallet + deposit;
    const income = Number(profile.total_income) || 0;
    const late = db.get(`SELECT COUNT(*) AS n FROM loans WHERE guild_id = ? AND borrower_type = 'user' AND borrower_id = ? AND status = 'delinquent'`,
        [guildId, String(userId)]);
    let score = 620;
    score += Math.min(100, Math.floor(income / 5000));
    score += Math.min(60, Math.floor(assets / 10000));
    score -= Math.min(180, Math.floor(debt / 5000));
    score -= (Number(late && late.n) || 0) * 45;
    return Math.max(300, Math.min(850, score));
}
function maxPrincipal(guildId, userId) {
    const profile = db.ensureProfile(guildId, userId);
    const income = Number(profile.total_income) || 0;
    const net = Math.max(0, db.netWorth(guildId, userId));
    const score = creditScore(guildId, userId);
    const factor = score >= 760 ? 5 : score >= 700 ? 4 : score >= 650 ? 2.5 : score >= 600 ? 1.5 : 0.7;
    return Math.max(50000, Math.floor((income * 3 + net * 2) * factor));
}
function quote(guildId, userId, requested, termCycles) {
    const principal = Math.max(0, Math.trunc(Number(requested) || 0));
    const limit = maxPrincipal(guildId, userId);
    const score = creditScore(guildId, userId);
    const risk = score >= 780 ? 150 : score >= 720 ? 250 : score >= 660 ? 400 : score >= 600 ? 650 : 1100;
    const annualBps = Math.max(100, policyRateBps(guildId) + risk);
    const term = Math.max(1, Math.min(120, Math.trunc(Number(termCycles) || 24)));
    const monthly = annualBps / 120000;
    const payment = monthly > 0
        ? Math.ceil(principal * monthly / (1 - Math.pow(1 + monthly, -term)))
        : Math.ceil(principal / term);
    return {
        principal,
        limit,
        score,
        annualBps,
        term,
        payment,
        total: payment * term,
        interest: payment * term - principal,
        eligible: principal > 0 && principal <= limit,
    };
}
function borrow(guildId, userId, requested, termCycles) {
    accounts.ensureUser(guildId, userId);
    const offer = quote(guildId, userId, requested, termCycles);
    if (!offer.eligible) throw new Error(`requested principal exceeds the current limit of ${offer.limit}`);
    if (accounts.bankVault(guildId) < offer.principal) throw new Error('the bank has insufficient loanable reserves');
    const at = nowIso();
    const guild = db.getGuild(guildId);
    const due = addMinutes(at, Number(guild.cycle_minutes) || 60);
    const result = db.run(`INSERT INTO loans
        (guild_id, borrower_type, borrower_id, principal_cents, balance_cents, rate_bps, term_cycles, payment_cents, cycles_paid, status, next_due_at, created_at, updated_at)
        VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?, ?)`,
        [guildId, String(userId), offer.principal, offer.principal, offer.annualBps, offer.term, offer.payment, due, at, at]);
    accounts.disburseLoan(guildId, 'user', userId, offer.principal, userId);
    db.audit(guildId, userId, 'loan_originated', { loanId: Number(result.lastInsertRowid), principal: offer.principal, rate: offer.annualBps, term: offer.term });
    return { ...offer, loanId: Number(result.lastInsertRowid) };
}
function repay(guildId, userId, amount) {
    const value = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!value) throw new Error('repayment must be positive');
    const loan = db.get(`SELECT * FROM loans WHERE guild_id = ? AND borrower_type = 'user' AND borrower_id = ? AND status IN ('active','delinquent') ORDER BY id LIMIT 1`,
        [guildId, String(userId)]);
    if (!loan) throw new Error('no active loan');
    const payment = Math.min(value, Number(loan.balance_cents));
    accounts.repayLoan(guildId, 'user', userId, payment, 0, userId);
    const remaining = Number(loan.balance_cents) - payment;
    if (remaining <= 0) {
        db.run('UPDATE loans SET balance_cents = 0, status = ?, updated_at = ? WHERE id = ?', ['repaid', nowIso(), loan.id]);
    } else {
        db.run('UPDATE loans SET balance_cents = ?, updated_at = ? WHERE id = ?', [remaining, nowIso(), loan.id]);
    }
    db.audit(guildId, userId, 'loan_repayment', { loanId: loan.id, amount: payment, remaining });
    return { loanId: loan.id, payment, remaining };
}
function accrueDeposits(guildId) {
    const rate = depositRateBps(guildId);
    if (!rate) return 0;
    const rows = db.all(`SELECT owner_id, balance FROM accounts WHERE guild_id = ? AND owner_type = 'user' AND kind = 'deposit' AND balance > 0`, [guildId]);
    let total = 0;
    for (const row of rows) {
        const interest = Math.floor(Number(row.balance) * rate / 120000);
        if (interest > 0) {
            accounts.accrueDepositInterest(guildId, row.owner_id, interest);
            total += interest;
        }
    }
    return total;
}
function serviceLoan(guildId, loan) {
    const guild = db.getGuild(guildId);
    const interest = Math.floor(Number(loan.balance_cents) * Number(loan.rate_bps) / 120000);
    if (interest > 0) accounts.accrueLoanInterest(guildId, loan.borrower_type, loan.borrower_id, interest, 'system');
    let balance = Number(loan.balance_cents) + interest;
    let payment = Math.min(Number(loan.payment_cents), balance);
    const available = loan.borrower_type === 'company'
        ? db.balanceOf(guildId, 'company', String(loan.borrower_id), 'cash')
        : db.walletBalance(guildId, loan.borrower_id);
    if (available >= payment) {
        accounts.repayLoan(guildId, loan.borrower_type, loan.borrower_id, payment, 0, 'system');
        balance -= payment;
        db.run('UPDATE loans SET balance_cents = ?, cycles_paid = cycles_paid + 1, status = ?, next_due_at = ?, updated_at = ? WHERE id = ?',
            [balance, balance <= 0 ? 'repaid' : 'active', addMinutes(nowIso(), Number(guild.cycle_minutes) || 60), nowIso(), loan.id]);
        const interestPaid = Math.min(interest, payment);
        const principalPaid = payment - interestPaid;
        db.run('INSERT INTO loan_payments (guild_id, loan_id, amount_cents, interest_cents, principal_cents, paid_at) VALUES (?, ?, ?, ?, ?, ?)',
            [guildId, loan.id, payment, interestPaid, principalPaid, nowIso()]);
    } else {
        db.run('UPDATE loans SET balance_cents = ?, status = ?, next_due_at = ?, updated_at = ? WHERE id = ?',
            [balance, 'delinquent', addMinutes(nowIso(), Number(guild.cycle_minutes) || 60), nowIso(), loan.id]);
    }
    return { loanId: loan.id, interest, payment, balance };
}
function runCycle(guildId) {
    const deposits = accrueDeposits(guildId);
    const loans = db.all(`SELECT * FROM loans WHERE guild_id = ? AND status IN ('active','delinquent')`, [guildId]);
    const serviced = loans.map(loan => serviceLoan(guildId, loan));
    return { depositInterest: deposits, loansServiced: serviced.length, loans: serviced };
}
function summary(guildId) {
    const vault = accounts.bankVault(guildId);
    const deposits = accounts.bankDeposits(guildId);
    const loans = accounts.bankLoanAssets(guildId);
    const reserveBps = depositBpsSafe(vault, deposits);
    return {
        policyRateBps: policyRateBps(guildId),
        depositRateBps: depositRateBps(guildId),
        reserveRatioBps: reserveRequirement(guildId),
        vault,
        deposits,
        loans,
        reserveBps,
        capital: vault + loans - deposits,
        moneySupply: accounts.moneySupply(guildId),
        depositCount: db.get(`SELECT COUNT(*) AS n FROM accounts WHERE guild_id = ? AND owner_type = 'user' AND kind = 'deposit' AND balance > 0`, [guildId]).n,
        loanCount: db.get(`SELECT COUNT(*) AS n FROM loans WHERE guild_id = ? AND status IN ('active','delinquent')`, [guildId]).n,
    };
}
function depositBpsSafe(vault, deposits) {
    if (!deposits) return 0;
    return Math.round(safeDiv(vault, deposits, 0) * 10000);
}
function loansFor(guildId, userId) {
    return db.all(`SELECT * FROM loans WHERE guild_id = ? AND borrower_type = 'user' AND borrower_id = ? ORDER BY id DESC`, [guildId, String(userId)]);
}
function loanView(guildId, userId) {
    const list = loansFor(guildId, userId);
    const total = list.filter(x => ['active', 'delinquent'].includes(x.status)).reduce((sum, x) => sum + Number(x.balance_cents), 0);
    return { loans: list, total, score: creditScore(guildId, userId), limit: maxPrincipal(guildId, userId) };
}
function rateText(guildId) {
    return `Policy **${formatBps(policyRateBps(guildId))}** | deposits **${formatBps(depositRateBps(guildId))}** | reserve requirement **${formatBps(reserveRequirement(guildId))}**`;
}
function setPolicyRate(guildId, bps) {
    const value = Math.max(-100, Math.min(5000, Math.trunc(Number(bps) || 0)));
    db.updateGuild(guildId, { policy_rate_bps: value });
    db.audit(guildId, null, 'policy_rate', { bps: value });
    return value;
}
function setReserveRatio(guildId, bps) {
    const value = Math.max(0, Math.min(5000, Math.trunc(Number(bps) || 0)));
    db.updateGuild(guildId, { reserve_ratio_bps: value });
    db.audit(guildId, null, 'reserve_ratio', { bps: value });
    return value;
}
function health(guildId) {
    const s = summary(guildId);
    const required = Math.floor(s.deposits * reserveRequirement(guildId) / 10000);
    const gap = Math.max(0, required - s.vault);
    const status = s.deposits > 0 && s.reserveBps < reserveRequirement(guildId) ? 'below requirement' : 'sound';
    return { ...s, required, gap, status };
}

module.exports = {
    policyRateBps,
    reserveRequirement,
    depositRateBps,
    debtTotal,
    creditScore,
    maxPrincipal,
    quote,
    borrow,
    repay,
    accrueDeposits,
    serviceLoan,
    runCycle,
    summary,
    loanView,
    loansFor,
    rateText,
    setPolicyRate,
    setReserveRatio,
    health,
    round,
};
