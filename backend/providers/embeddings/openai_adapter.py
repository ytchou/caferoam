from openai import AsyncOpenAI


class OpenAIEmbeddingsAdapter:
    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model
        self._dimensions = 1536

    @property
    def dimensions(self) -> int:
        return self._dimensions

    @property
    def model_id(self) -> str:
        return self._model

    async def embed(self, text: str) -> list[float]:
        response = await self._client.embeddings.create(model=self._model, input=text)
        return response.data[0].embedding  # safe: OpenAI guarantees data[0] on success

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        response = await self._client.embeddings.create(model=self._model, input=texts)
        return [item.embedding for item in response.data]
