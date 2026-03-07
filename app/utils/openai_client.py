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
    api_key = os.getenv("OPENAI_API_KEY")
    api_base = os.getenv("OPENAI_API_BASE")

    # ``OpenAI`` constructor doesn't accept ``api_base`` directly, so we
    # set it on the returned object if provided.
    client = OpenAI(api_key=api_key) if api_key else OpenAI()

    if api_base:
        client.api_base = api_base

    return client
