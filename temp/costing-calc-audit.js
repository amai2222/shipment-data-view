// 与多维物流成本核算页同一套内核，做极端条件交叉验证
function dRound(num) {
    return Math.round((parseFloat(num) + Number.EPSILON) * 100) / 100;
}
function vatSettle(outVat, inVat) {
    return {
        payVat: dRound(Math.max(0, outVat - inVat)),
        unusedVat: dRound(Math.max(0, inVat - outVat))
    };
}
function vatSplit(cash, rate) {
    cash = dRound(cash);
    if (rate > 0) {
        let excl = dRound(cash / (1 + rate));
        return { excl: excl, vat: dRound(cash - excl) };
    }
    return { excl: cash, vat: 0 };
}
function splitRev(r, qty, force) {
    let inc = force && force.inc != null ? force.inc : r.inc;
    let rate = force && force.rate != null ? force.rate : r.rate;
    let amt = force && force.cash != null ? force.cash : r.amt * qty;
    let cash, excl, outVat;
    if (inc) {
        cash = dRound(amt);
        let split = vatSplit(cash, rate);
        excl = split.excl;
        outVat = split.vat;
    } else {
        excl = dRound(amt);
        outVat = dRound(excl * rate);
        cash = dRound(excl + outVat);
    }
    return { cash: cash, excl: excl, outVat: outVat };
}
function splitCost(c, qty, pRate, upRate, smallMode) {
    let raw;
    if (c.ticket === 3) {
        let net = dRound(c.amt * qty);
        let cash = (pRate > 0 && pRate < 1) ? dRound(net / (1 - pRate)) : net;
        let split = vatSplit(cash, upRate);
        raw = { cash: cash, excl: split.excl, inVat: split.vat, costDeduct: split.excl, taxDeduct: split.excl, stampExcl: split.excl };
    } else {
        let cash = dRound(c.amt * qty);
        if (c.ticket === 2) {
            let split = vatSplit(cash, c.rate);
            raw = { cash: cash, excl: split.excl, inVat: split.vat, costDeduct: split.excl, taxDeduct: split.excl, stampExcl: split.excl };
        } else if (c.ticket === 1) {
            let split = vatSplit(cash, c.rate);
            raw = { cash: cash, excl: split.excl, inVat: 0, costDeduct: cash, taxDeduct: cash, stampExcl: split.excl };
        } else {
            raw = { cash: cash, excl: cash, inVat: 0, costDeduct: cash, taxDeduct: 0, stampExcl: cash };
        }
    }
    if (smallMode) {
        return {
            cash: raw.cash, excl: raw.cash, inVat: 0,
            costDeduct: raw.cash, taxDeduct: c.ticket === 0 ? 0 : raw.cash, stampExcl: raw.stampExcl
        };
    }
    return raw;
}
function calcTotals(cfg) {
    let st = cfg.state;
    let qty = cfg.qty, pRate = cfg.pRate, surRate = cfg.surRate, incRate = cfg.incRate;
    let stampRate = cfg.stampRate, upRate = cfg.upRate || 0, small = !!cfg.small, forceFirst = cfg.forceFirst;
    let cashRev = 0, revExcl = 0, outVat = 0, cashCost = 0, costExcl = 0, taxDeduct = 0, inVat = 0, stampBase = 0;
    st.revs.forEach((r, i) => {
        let s = splitRev(r, qty, (forceFirst && i === 0) ? forceFirst : null);
        cashRev += s.cash; revExcl += s.excl; outVat += s.outVat;
        if (r.stamp) stampBase += s.excl;
    });
    st.costs.forEach(c => {
        let s = splitCost(c, qty, pRate, upRate, small);
        cashCost += s.cash; costExcl += s.costDeduct; taxDeduct += s.taxDeduct; inVat += s.inVat;
        if (c.stamp) stampBase += s.stampExcl;
    });
    cashRev = dRound(cashRev); revExcl = dRound(revExcl); outVat = dRound(outVat);
    cashCost = dRound(cashCost); costExcl = dRound(costExcl); taxDeduct = dRound(taxDeduct);
    inVat = dRound(inVat); stampBase = dRound(stampBase);
    let vat = vatSettle(outVat, inVat);
    let unusedVat = vat.unusedVat, payVat = vat.payVat;
    if (unusedVat > 0) {
        taxDeduct = dRound(taxDeduct + unusedVat);
        costExcl = dRound(costExcl + unusedVat);
    }
    let sur = dRound(payVat * surRate);
    let stamp = dRound(stampBase * stampRate);
    let taxableInc = dRound(revExcl - taxDeduct - sur - stamp);
    let incTax = dRound(Math.max(0, taxableInc * incRate));
    let totalTax = dRound(payVat + sur + stamp + incTax);
    let otherTax = dRound(sur + stamp + incTax);
    let cashMargin = dRound(cashRev - cashCost);
    let netProfit = dRound(cashMargin - totalTax);
    let f2Profit = dRound(revExcl - costExcl - otherTax);
    return { cashRev, revExcl, outVat, cashCost, costExcl, taxDeduct, inVat, stampBase, unusedVat, payVat, sur, stamp, taxableInc, incTax, totalTax, otherTax, cashMargin, netProfit, f2Profit };
}

function findMin(rates, invoiceRate) {
    function trial(R) {
        return calcTotals(Object.assign({}, rates, { forceFirst: { cash: R, inc: invoiceRate > 0, rate: invoiceRate } }));
    }
    if (trial(0).netProfit >= 0) return 0;
    let highCents = Math.max(100, Math.ceil((calcTotals(rates).cashCost + 1) * 400));
    let tHigh = trial(highCents / 100);
    while (tHigh.netProfit < 0 && highCents < 1e12) {
        highCents *= 2;
        tHigh = trial(highCents / 100);
    }
    let lowCents = 0, bestCents = highCents;
    while (lowCents <= highCents) {
        let mid = Math.floor((lowCents + highCents) / 2);
        if (trial(mid / 100).netProfit >= 0) { bestCents = mid; highCents = mid - 1; }
        else lowCents = mid + 1;
    }
    return bestCents / 100;
}

let fail = 0;
function ok(name, cond, extra) {
    if (cond) console.log('OK  ' + name);
    else { fail++; console.log('FAIL ' + name + (extra ? ' ' + extra : '')); }
}

const baseRates = { qty: 1, pRate: 0.075, surRate: 0.06, incRate: 0.05, stampRate: 0.00015, upRate: 0.09, small: false };
const defState = {
    revs: [{ name: '主营', amt: 55, rate: 0.09, inc: true, stamp: true }],
    costs: [
        { name: '外包', amt: 40, rate: 0.01, ticket: 2, stamp: true },
        { name: '居间', amt: 10, rate: 0.01, ticket: 1, stamp: false }
    ]
};

(function defaultCase() {
    let t = calcTotals(Object.assign({ state: defState }, baseRates));
    ok('默认交叉验证', Math.abs(t.netProfit - t.f2Profit) < 0.01, t.netProfit + ' vs ' + t.f2Profit);
    ok('默认销项 4.54', t.outVat === 4.54, String(t.outVat));
    ok('默认进项外包专票', t.inVat === dRound(40 - dRound(40 / 1.01)), String(t.inVat));
    ok('默认应缴增值税 = 销项-进项', t.payVat === dRound(t.outVat - t.inVat));
})();

(function qty0() {
    let t = calcTotals(Object.assign({ state: defState }, baseRates, { qty: 0 }));
    ok('数量0全为0', t.cashRev === 0 && t.cashCost === 0 && t.netProfit === 0);
    ok('数量0交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function qty100000() {
    let t = calcTotals(Object.assign({ state: defState }, baseRates, { qty: 100000 }));
    ok('十万倍交叉', Math.abs(t.netProfit - t.f2Profit) < 0.02, t.netProfit + ' vs ' + t.f2Profit);
    ok('十万倍收入 5,500,000', t.cashRev === 5500000, String(t.cashRev));
})();

(function smallScale() {
    let t = calcTotals(Object.assign({ state: defState }, baseRates, { small: true, upRate: 0.01 }));
    ok('小规模进项为0', t.inVat === 0);
    ok('小规模交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function noInvoiceCost() {
    let st = { revs: defState.revs, costs: [{ amt: 40, rate: 0, ticket: 0, stamp: false }] };
    let t = calcTotals(Object.assign({ state: st }, baseRates));
    ok('没票不能扣所得税', t.taxDeduct === t.unusedVat);
    ok('没票交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function unusedVat() {
    let st = {
        revs: [{ amt: 10, rate: 0.09, inc: true, stamp: false }],
        costs: [{ amt: 100, rate: 0.09, ticket: 2, stamp: false }]
    };
    let t = calcTotals(Object.assign({ state: st }, baseRates));
    ok('进项大于销项应缴0', t.payVat === 0);
    ok('未抵扣进项>0', t.unusedVat > 0);
    ok('多进项交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01, t.netProfit + ' vs ' + t.f2Profit);
})();

(function withhold() {
    let st = {
        revs: [{ amt: 80, rate: 0.09, inc: true, stamp: true }],
        costs: [{ amt: 50, rate: 0.075, ticket: 3, stamp: true }]
    };
    let t = calcTotals(Object.assign({ state: st }, baseRates));
    let gross = dRound(50 / (1 - 0.075));
    ok('代扣还原含税', t.cashCost === gross, t.cashCost + ' vs ' + gross);
    ok('代扣交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function openNoInvoiceRev() {
    let st = {
        revs: [{ amt: 55, rate: 0, inc: false, stamp: true }],
        costs: defState.costs
    };
    let t = calcTotals(Object.assign({ state: st }, baseRates));
    ok('不开票销项0', t.outVat === 0);
    ok('不开票现金=实收', t.cashRev === 55);
    ok('不开票交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function lossNoIncomeTax() {
    let st = {
        revs: [{ amt: 10, rate: 0.09, inc: true, stamp: false }],
        costs: [{ amt: 100, rate: 0.01, ticket: 1, stamp: false }]
    };
    let t = calcTotals(Object.assign({ state: st }, baseRates));
    ok('亏损所得税0', t.incTax === 0);
    ok('亏损交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function zeroRates() {
    let t = calcTotals(Object.assign({ state: defState }, baseRates, { surRate: 0, incRate: 0, stampRate: 0 }));
    ok('税率全0交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
    ok('税率全0无附加印花所得', t.sur === 0 && t.stamp === 0 && t.incTax === 0);
})();

(function tiny() {
    let st = {
        revs: [{ amt: 0.01, rate: 0.09, inc: true, stamp: true }],
        costs: [{ amt: 0.01, rate: 0.01, ticket: 2, stamp: true }]
    };
    let t = calcTotals(Object.assign({ state: st }, baseRates));
    ok('一分钱交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function emptyRev() {
    let st = { revs: [], costs: defState.costs };
    let t = calcTotals(Object.assign({ state: st }, baseRates));
    ok('无收入交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function emptyCost() {
    let st = { revs: defState.revs, costs: [] };
    let t = calcTotals(Object.assign({ state: st }, baseRates));
    ok('无支出交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function multiRev() {
    let st = {
        revs: [
            { amt: 55, rate: 0.09, inc: true, stamp: true },
            { amt: 8, rate: 0, inc: false, stamp: false }
        ],
        costs: defState.costs
    };
    let t = calcTotals(Object.assign({ state: st }, baseRates));
    ok('多项收入交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function highIncomeTax() {
    let t = calcTotals(Object.assign({ state: defState }, baseRates, { incRate: 0.25, surRate: 0.12, stampRate: 0.0003 }));
    ok('优惠到期税率交叉', Math.abs(t.netProfit - t.f2Profit) < 0.01);
})();

(function breakevenDefault() {
    let rates = Object.assign({ state: defState }, baseRates);
    let no = findMin(rates, 0);
    let inv = findMin(rates, 0.09);
    let tNo = calcTotals(Object.assign({}, rates, { forceFirst: { cash: no, inc: false, rate: 0 } }));
    let tInv = calcTotals(Object.assign({}, rates, { forceFirst: { cash: inv, inc: true, rate: 0.09 } }));
    ok('保本不开票净利>=0', tNo.netProfit >= 0, String(tNo.netProfit));
    ok('保本开票净利>=0', tInv.netProfit >= 0, String(tInv.netProfit));
    if (no >= 0.01) {
        let tLow = calcTotals(Object.assign({}, rates, { forceFirst: { cash: dRound(no - 0.01), inc: false, rate: 0 } }));
        ok('保本不开票少1分亏损或持平', tLow.netProfit <= 0.009, String(tLow.netProfit));
    }
    if (inv >= 0.01) {
        let tLow = calcTotals(Object.assign({}, rates, { forceFirst: { cash: dRound(inv - 0.01), inc: true, rate: 0.09 } }));
        ok('保本开票少1分亏损或持平', tLow.netProfit <= 0.009, String(tLow.netProfit));
    }
})();

(function breakevenHugeQty() {
    let rates = Object.assign({ state: defState }, baseRates, { qty: 10000 });
    let inv = findMin(rates, 0.09);
    let tInv = calcTotals(Object.assign({}, rates, { forceFirst: { cash: inv, inc: true, rate: 0.09 } }));
    ok('万倍保本净利>=0', tInv.netProfit >= 0);
    ok('万倍保本交叉', Math.abs(tInv.netProfit - tInv.f2Profit) < 0.05, tInv.netProfit + ' vs ' + tInv.f2Profit);
})();

(function pRateEdge() {
    let st = { revs: defState.revs, costs: [{ amt: 40, ticket: 3, stamp: false }] };
    let t0 = calcTotals(Object.assign({ state: st }, baseRates, { pRate: 0 }));
    ok('代扣税率0不还原', t0.cashCost === 40);
    let tBad = calcTotals(Object.assign({ state: st }, baseRates, { pRate: 1 }));
    ok('代扣税率100%不除零', tBad.cashCost === 40);
})();

console.log(fail ? ('失败 ' + fail + ' 项') : '全部通过');
process.exit(fail ? 1 : 0);
