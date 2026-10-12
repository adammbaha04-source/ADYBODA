"""Deduction (Makato) fee table, copied from the old app's calculateMakato()."""

PESAFASTA = [(19999, 1100), (39999, 1300), (99999, 1400), (199999, 1500), (299000, 1700), (400000, 1800)]
ATM = [(199999, 2000), (400000, 2200)]
MITANDAO = [(100000, 2500), (500000, 3500), (1000000, 4000)]
TABLES = {"pesafasta": PESAFASTA, "atm": ATM, "mitandao": MITANDAO}


def makato_fee(kind: str, amount: int) -> int:
    """Fee for a transaction. 0 if the type is unknown or the amount is above the table."""
    if amount <= 0:
        return 0
    for limit, fee in TABLES.get(kind, []):
        if amount <= limit:
            return fee
    return 0
