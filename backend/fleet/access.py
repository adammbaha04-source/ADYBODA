"""Roles and access rules: owner, manager, driver.

- owner: no Membership row. Sees and changes everything in his own business.
- manager: Membership(role=manager). Sees and writes only the vehicles assigned to him.
- driver: Membership(role=driver). Sees only his one vehicle. Read-only, except confirming his own records.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS
from fleet.models import Membership, Vehicle


def membership_of(user):
    return Membership.objects.filter(user=user).select_related("business_owner").first()


def role_of(user) -> str:
    m = membership_of(user)
    return m.role if m else "owner"


def business_owner(user):
    m = membership_of(user)
    return m.business_owner if m else user


def vehicles_for(user):
    m = membership_of(user)
    if m is None:
        return Vehicle.objects.filter(owner=user)
    return m.vehicles.all()


class ScopedPermission(BasePermission):
    """Reads: any signed-in role (queries are already scoped). Writes: owner always;
    manager only where the view sets manager_can_write = True; driver never."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        if getattr(view, "action", None) == "confirm":
            return True  # the confirm action checks the role itself (driver only)
        role = role_of(request.user)
        if role == "owner":
            return True
        if role == "manager":
            return bool(getattr(view, "manager_can_write", False))
        return False
