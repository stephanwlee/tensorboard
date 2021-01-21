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
"""TensorBoard Asset Provider.

An asset provider provides static list of assets to be served by TensorBoard web
server.
"""

import io
import gzip
import zipfile

from abc import ABCMeta
from abc import abstractmethod


class AssetProvider(metaclass=ABCMeta):
    """Interface for providing static assets to TensorBoard web server."""

    @abstractmethod
    def list_static_files(self):
        """List static asset files to be served.

        Returns:
            A list of file paths of the assets. Do note that the assets are
            served at the file path under path prefix user has specified. For
            example, a path, "foo/bar.html" will be served at
            "http://localhost:6006/[path_prefix]/foo/bar.html". In case of
            "./index.html", it is special cased to be served both under
            "[path_prefix]/" and "[path_prefix]/index.html"
        """
        pass

    @abstractmethod
    def get_gzipped_file_content(self, file_path, gzip):
        """Returns gzipped content of the file.

        Args:
            file_path: One of string file path to an asset returned by
              `list_static_files`.
            gzip: Whether to gzip the content.

        Returns:
            bytestring of file content.
        """
        pass


def _gzip(bytestring):
    out = io.BytesIO()
    # Set mtime to zero for deterministic results across TensorBoard launches.
    with gzip.GzipFile(fileobj=out, mode="wb", compresslevel=3, mtime=0) as f:
        f.write(bytestring)
    return out.getvalue()


class CachedZipAssetProvider(AssetProvider):
    def __init__(self, assets_zip_provider):
        """Asset Provider based on assets_zip_provider that caches the read file.

        The provider unzips and reads file contents once and holds them on a
        dict. When the underlying file content changes, the provider will not
        return the latest content.

        Args:
          assets_zip_provider: A function returns file descriptor to a zip file.
        """
        self._paths = []
        self._path_to_gzip = dict()
        self._path_to_raw = dict()

        with assets_zip_provider() as fp:
            with zipfile.ZipFile(fp) as zip_:
                self._paths = zip_.namelist()
                for path in self._paths:
                    content = zip_.read(path)
                    # For performance, pre-gzip and hold onto it.
                    gzipped_content = _gzip(content)

                    self._path_to_raw[path] = content
                    self._path_to_gzip[path] = gzipped_content

    def list_static_files(self):
        return self._paths

    def get_gzipped_file_content(self, file_path, gzip):
        return (
            self._path_to_gzip[file_path]
            if gzip
            else self._path_to_raw[file_path]
        )
