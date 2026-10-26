import { add, type Paise } from "@/lib/money";

/** Net bill after credit notes (never negative). */
export function netBillPaise(input: {
  totalPaise: Paise;
  creditNotesTotalPaise: Paise;
}): Paise {
  const net = input.totalPaise - input.creditNotesTotalPaise;
  return net > 0 ? net : 0;
}

/** Amount still due after payments and credit notes (never negative). */
export function pendingBalancePaise(input: {
  totalPaise: Paise;
  amountPaidPaise: Paise;
  creditNotesTotalPaise: Paise;
}): Paise {
  const due =
    netBillPaise({
      totalPaise: input.totalPaise,
      creditNotesTotalPaise: input.creditNotesTotalPaise,
    }) - input.amountPaidPaise;
  return due > 0 ? due : 0;
}

/** Money to return when payments exceed the net bill after credit notes. */
export function refundDuePaise(input: {
  totalPaise: Paise;
  amountPaidPaise: Paise;
  creditNotesTotalPaise: Paise;
}): Paise {
  const excess =
    input.amountPaidPaise -
    netBillPaise({
      totalPaise: input.totalPaise,
      creditNotesTotalPaise: input.creditNotesTotalPaise,
    });
  return excess > 0 ? excess : 0;
}

export function sumCreditNotesPaise(
  notes: readonly { totalPaise: Paise }[],
): Paise {
  return notes.reduce((sum, note) => add(sum, note.totalPaise), 0);
}
