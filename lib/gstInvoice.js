function roundPaise(n) {
    return Math.round(Number(n) || 0);
  }
  
  export function splitGstFromInclusiveTotal({ grandTotalPaise, gstRatePct, orgStateCode, buyerStateCode }) {
    const R = Number(gstRatePct || 0) / 100;
    if (!grandTotalPaise || grandTotalPaise <= 0) throw new Error("Invalid amount");
    if (R <= 0) {
      return {
        taxablePaise: grandTotalPaise,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalTaxPaise: 0,
      };
    }
  
    // inclusive GST: total = taxable * (1+R)
    const taxablePaise = roundPaise(grandTotalPaise / (1 + R));
    const totalTaxPaise = grandTotalPaise - taxablePaise;
  
    let cgstPaise = 0, sgstPaise = 0, igstPaise = 0;
  
    // If buyerStateCode missing → safest is treat as IGST 0 and put all tax as “unsplit” IGST
    // (government finance team usually wants correct split; so buyerStateCode is important)
    const o = String(orgStateCode || "");
    const b = String(buyerStateCode || "");
  
    if (!b) {
      igstPaise = totalTaxPaise;
      return { taxablePaise, cgstPaise, sgstPaise, igstPaise, totalTaxPaise };
    }
  
    if (o && b && o === b) {
      const half = roundPaise(totalTaxPaise / 2);
      cgstPaise = half;
      sgstPaise = totalTaxPaise - half; // fix rounding
      igstPaise = 0;
    } else {
      igstPaise = totalTaxPaise;
      cgstPaise = 0;
      sgstPaise = 0;
    }
  
    return { taxablePaise, cgstPaise, sgstPaise, igstPaise, totalTaxPaise };
  }
  
  export async function nextInvoiceNo(prisma) {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
  
    const last = await prisma.invoice.findFirst({
      where: { invoiceNo: { startsWith: prefix } },
      orderBy: { id: "desc" },
      select: { invoiceNo: true },
    });
  
    const lastSeq = last?.invoiceNo?.split("-")?.[2];
    const seq = Number(lastSeq || 0) + 1;
  
    return `${prefix}${String(seq).padStart(6, "0")}`;
  }