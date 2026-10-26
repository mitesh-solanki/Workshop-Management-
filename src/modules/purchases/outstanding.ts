export function vendorOutstandingPaise(input: {
  billsPaise: number;
  paymentsPaise: number;
  returnsCreditPaise: number;
}): number {
  return input.billsPaise - input.paymentsPaise - input.returnsCreditPaise;
}

export function billOutstandingPaise(input: {
  amountPaise: number;
  paymentsPaise: number;
  returnsCreditPaise: number;
}): number {
  return Math.max(
    0,
    input.amountPaise - input.paymentsPaise - input.returnsCreditPaise,
  );
}
