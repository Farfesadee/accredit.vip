from abc import ABC, abstractmethod
from app.core.config import settings


class MessageProvider(ABC):
    @abstractmethod
    async def send(self, recipient: str, subject: str, body: str) -> bool:
        pass


class ConsoleProvider(MessageProvider):
    async def send(self, recipient: str, subject: str, body: str) -> bool:
        print(f"[{subject}] To: {recipient}")
        print(f"Body: {body[:100]}...")
        return True


def get_provider(channel: str) -> MessageProvider:
    return ConsoleProvider()
