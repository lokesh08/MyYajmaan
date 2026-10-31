import pytest

import response_cache


@pytest.fixture(autouse=True)
def _fresh_response_cache():
    # Tests swap in different fake databases for the same public URL;
    # never let one test's cached answer leak into the next.
    response_cache.clear()
    yield
    response_cache.clear()
