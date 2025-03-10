from dataclasses import dataclass

from bdapp.exceptions.base import ApplicationException


@dataclass(eq=False)
class SolveException(ApplicationException):
    message: str

    @property
    def message(self):
        return f'{self.message}'
    