from datetime import date
import unittest
from fleet.engine import (VehicleConfig, ReturnRecord, generate_entries, rebuild_chain)


class WeekChosenOnForm(unittest.TestCase):
    def cfg(self):
        return VehicleConfig(daily_target=16000, working_days_count=6)

    def run_chain(self, rets):
        return rebuild_chain(generate_entries(self.cfg(), rets, {}, "2026-10", "2026-10"))

    def test_deficit_then_excess_reduces_debt(self):
        rets = [ReturnRecord(date(2026, 10, 14), 90000, False, "2026-10", 1),
                ReturnRecord(date(2026, 10, 14), 90000, False, "2026-10", 2),
                ReturnRecord(date(2026, 10, 14), 100000, False, "2026-10", 3)]
        rows = [e for e in self.run_chain(rets) if e.week_number]
        self.assertEqual([e.remaining_debt for e in rows][:3], [6000, 12000, 8000])

    def test_week_follows_chosen_week_not_payment_date(self):
        rets = [ReturnRecord(date(2026, 10, 30), 96000, False, "2026-10", 1)]
        rows = [e for e in self.run_chain(rets) if e.week_number]
        self.assertEqual(rows[0].remaining_debt, 0)
        self.assertEqual(rows[3].new_debt, 96000)

    def test_extra_payment_reduces_debt_without_counting_as_income(self):
        rets = [ReturnRecord(date(2026, 10, 14), 50000, True, "2026-10", 2)]
        rows = [e for e in self.run_chain(rets) if e.week_number]
        self.assertIn("Income 0", rows[1].notes)
        self.assertEqual(rows[1].paid_debt, 50000)

    def test_confirmed_flag(self):
        rets = [ReturnRecord(date(2026, 10, 14), 96000, False, "2026-10", 1, True)]
        rows = [e for e in self.run_chain(rets) if e.week_number]
        self.assertTrue(rows[0].confirmed)
        self.assertIsNone(rows[1].confirmed)
