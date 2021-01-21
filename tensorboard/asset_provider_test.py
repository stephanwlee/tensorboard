# Copyright 2021 The TensorFlow Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
"""Tests for tensorboard.asset_provider."""

import contextlib
import io
import zipfile

from tensorboard import asset_provider
from tensorboard import test as tb_test


FAKE_INDEX_HTML = b"<!doctype html>hello"
FAKE_INDEX_JS = b"var hi=''"


class CachedZipAssetProviderTest(tb_test.TestCase):
    def create_provider(self):
        return asset_provider.CachedZipAssetProvider(
            get_test_assets_zip_provider()
        )

    def test_list_files(self):
        provider = self.create_provider()
        self.assertEqual(
            provider.list_static_files(), ["index.html", "index.js"]
        )

    def test_get_file_no_gzip(self):
        provider = self.create_provider()
        self.assertEqual(
            provider.get_gzipped_file_content("index.html", False),
            FAKE_INDEX_HTML,
        )
        self.assertEqual(
            provider.get_gzipped_file_content("index.js", False),
            FAKE_INDEX_JS,
        )

    def test_get_file_no_file(self):
        provider = self.create_provider()
        with self.assertRaises(KeyError):
            provider.get_gzipped_file_content("hello", True)


def get_test_assets_zip_provider():
    memfile = io.BytesIO()
    with zipfile.ZipFile(
        memfile, mode="w", compression=zipfile.ZIP_DEFLATED
    ) as zf:
        zf.writestr("index.html", FAKE_INDEX_HTML)
        zf.writestr("index.js", FAKE_INDEX_JS)
    return lambda: contextlib.closing(io.BytesIO(memfile.getvalue()))


if __name__ == "__main__":
    tb_test.main()
