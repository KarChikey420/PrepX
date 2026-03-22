"""
models.user
~~~~~~~~~~~~
User domain model (Beanie ODM document for MongoDB).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from beanie import Document
from pydantic import EmailStr, Field


class User(Document):
    """
    Represents a platform user who takes AI voice interviews.

    Attributes:
        email: User's unique email address.
        history: List of InterviewSession IDs the user has participated in.
        skill_matrix: Historical performance per skill — maps skill name
                      to a list of scores across sessions.
        created_at: Account creation timestamp.
    """

    email: EmailStr
    history: List[str] = Field(default_factory=list, description="List of session IDs")
    skill_matrix: Dict[str, List[int]] = Field(
        default_factory=dict,
        description="Mapping of skill name → list of historical scores (1-10)",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    display_name: Optional[str] = None

    class Settings:
        name = "users"
        use_state_management = True

    class Config:
        json_schema_extra = {
            "example": {
                "email": "developer@example.com",
                "history": ["sess_abc123"],
                "skill_matrix": {"python": [7, 8, 9], "system_design": [5, 6]},
                "display_name": "Jane Doe",
            }
        }
