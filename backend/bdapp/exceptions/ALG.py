from dataclasses import dataclass

from bdapp.exceptions.base import ApplicationException


@dataclass(eq=False)
class AlgIsNotFoundException(ApplicationException):
    alg_name: str

    @property
    def message(self):
        return f'{self.alg_id} is not found'