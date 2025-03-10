from dataclasses import dataclass

from bdapp.exceptions.base import ApplicationException


@dataclass(eq=False)
class Interpritation_Selector_IDNotFoundException(ApplicationException):
    interpritation_id: str

    @property
    def message(self):
        return f'{self.interpritation_id} is not found'
    