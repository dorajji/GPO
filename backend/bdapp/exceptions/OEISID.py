from dataclasses import dataclass

from bdapp.exceptions.base import ApplicationException


@dataclass(eq=False)
class OEIS_IDNotFoundException(ApplicationException):
    oeis_id: str

    @property
    def message(self):
        return f'{self.oeis_id} is not found'
    