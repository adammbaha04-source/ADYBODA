"""Tenant and role scoping for AdyBoda AI tools.

Every tool must use visible_vehicles(user); never accept an owner/user id from the AI.
"""
from fleet.access import vehicles_for, role_of, business_owner


def visible_vehicles(user):
    """Vehicles visible to the authenticated account, as defined by existing roles."""
    return vehicles_for(user)


def can_read_owner_finances(user):
    """Personal expenses belong to the owner and are not exposed to team members."""
    return role_of(user) == "owner"


def role_context(user):
    return {
        "role": role_of(user),
        "business_owner_id": business_owner(user).id,
        "visible_vehicle_ids": list(visible_vehicles(user).values_list("id", flat=True)),
    }
