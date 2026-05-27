import os
from dotenv import load_dotenv
from openai import OpenAI

# Load .env (called once when this module is imported)
load_dotenv()


def get_openai_client() -> OpenAI:
    """Return a configured OpenAI client.

    This helper centralises configuration so the rest of the codebase
    doesn't need to know about environment variables or OpenRouter.

    It will read the following environment variables, falling back to the
    normal OpenAI defaults if they are not set:

    * OPENAI_API_KEY    - the key you receive from OpenRouter/OVH/etc.
    * OPENAI_API_BASE   - the base url for the API (e.g. ``https://openrouter.ai/api/v1``)
    * OPENAI_API_MODEL  - optional default model to use (not required)
    """
    api_key = os.getenv("OPENAI_API_KEY") or "any-key"
    api_base = os.getenv("OPENAI_API_BASE")

    # OpenAI SDK v1 expects `base_url`, not `api_base`.
    client_kwargs = {"api_key": api_key}
    if api_base:
        client_kwargs["base_url"] = api_base

    client = OpenAI(**client_kwargs)
    return client
