# Copyright 2017 The TensorFlow Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the 'License');
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an 'AS IS' BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
TensorBoard external JS dependencies (both infrastructure and frontend libs)
"""

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")
load("@io_bazel_rules_closure//closure:defs.bzl", "filegroup_external", "web_library_external")

def tensorboard_js_workspace():
    """TensorBoard JavaScript dependencies."""

    ##############################################################################
    # TensorBoard Build Tools

    filegroup_external(
        name = "org_nodejs",
        # MIT with portions licensed:
        # - MIT
        # - Old MIT
        # - 2-Clause-BSD
        # - 3-Clause-BSD
        # - ISC
        # - Unicode
        # - zlib
        # - Artistic 2.0
        licenses = ["notice"],
        sha256_urls_extract_macos = {
            "910395e1e98fb351c62b5702a9deef22aaecf05d6df1d7edc283337542207f3f": [
                "http://mirror.tensorflow.org/nodejs.org/dist/v6.9.1/node-v6.9.1-darwin-x64.tar.xz",
                "http://nodejs.org/dist/v6.9.1/node-v6.9.1-darwin-x64.tar.xz",
            ],
        },
        sha256_urls_windows = {
            "1914bfb950be8d576ce9e49c8a0e51c9f2402560fe3c19093e69bc1306a56e9e": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/nodejs/node/v6.9.1/LICENSE",
                "https://raw.githubusercontent.com/nodejs/node/v6.9.1/LICENSE",
            ],
            "513923b0490ebb7466a56483a62595814ed9d036d6f35476debb0cd606bec526": [
                "http://mirror.tensorflow.org/nodejs.org/dist/v6.9.1/win-x64/node.exe",
                "http://nodejs.org/dist/v6.9.1/win-x64/node.exe",
            ],
            "3951aefa4afd6fb836ab06468b1fc2a69fa75bd66ec2f5a0e08c4e32547681e3": [
                "http://mirror.tensorflow.org/nodejs.org/dist/v6.9.1/win-x64/node.lib",
                "http://nodejs.org/dist/v6.9.1/win-x64/node.lib",
            ],
        },
        sha256_urls_extract = {
            "d4eb161e4715e11bbef816a6c577974271e2bddae9cf008744627676ff00036a": [
                "http://mirror.tensorflow.org/nodejs.org/dist/v6.9.1/node-v6.9.1-linux-x64.tar.xz",
                "http://nodejs.org/dist/v6.9.1/node-v6.9.1-linux-x64.tar.xz",
            ],
        },
        sha256_urls_extract_ppc64le = {
            "6f6362cba63c20eab4914c2983edd9699c1082792d0a35ef9c54d18b6c488e59": [
                "http://nodejs.org/dist/v6.9.1/node-v6.9.1-linux-ppc64le.tar.xz",
            ],
        },
        strip_prefix = {
            "node-v6.9.1-darwin-x64.tar.xz": "node-v6.9.1-darwin-x64",
            "node-v6.9.1-linux-x64.tar.xz": "node-v6.9.1-linux-x64",
            "node-v6.9.1-linux-ppc64le.tar.xz": "node-v6.9.1-linux-ppc64le",
        },
        executable = [
            "node",
            "node.exe",
        ],
    )

    filegroup_external(
        name = "com_microsoft_typescript",
        licenses = ["notice"],
        sha256_urls = {
            "a7d00bfd54525bc694b6e32f64c7ebcf5e6b7ae3657be5cc12767bce74654a47": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/Microsoft/TypeScript/v2.7.2/LICENSE.txt",
                "https://raw.githubusercontent.com/Microsoft/TypeScript/v2.9.2/LICENSE.txt",
            ],
            "9632bfccde117a8c82690a324bc5c18c3869e9b89ac536fc134ba655d7ec1e98": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/Microsoft/TypeScript/v2.9.2/lib/tsc.js",
                "https://raw.githubusercontent.com/Microsoft/TypeScript/v2.9.2/lib/tsc.js",
            ],
            "529c9f8b45939e0fa80950208bf80452ccb982b460cc25433813c919b67a3b2f": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/Microsoft/TypeScript/v2.9.2/lib/lib.es6.d.ts",
                "https://raw.githubusercontent.com/Microsoft/TypeScript/v2.9.2/lib/lib.es6.d.ts",
            ],
            "f6e6efe57fb9fcf72eed013e2755d04505300f32b78577118ca5dacc85ec852d": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/Microsoft/TypeScript/v2.9.2/lib/lib.dom.d.ts",
                "https://raw.githubusercontent.com/Microsoft/TypeScript/v2.9.2/lib/lib.dom.d.ts",
            ],
        },
        extra_build_file_content = "\n".join([
            "sh_binary(",
            "    name = \"tsc\",",
            "    srcs = [\"tsc.sh\"],",
            "    data = [",
            "        \"tsc.js\",",
            "        \"@org_nodejs\",",
            "    ],",
            ")",
            "",
            "genrule(",
            "    name = \"tsc_sh\",",
            "    outs = [\"tsc.sh\"],",
            "    cmd = \"cat >$@ <<'EOF'\\n\" +",
            "          \"#!/bin/bash\\n\" +",
            "          \"NODE=external/org_nodejs/bin/node\\n\" +",
            "          \"if [[ -e external/org_nodejs/node.exe ]]; then\\n\" +",
            "          \"  NODE=external/org_nodejs/node.exe\\n\" +",
            "          \"fi\\n\" +",
            "          \"exec $${NODE} external/com_microsoft_typescript/tsc.js \\\"$$@\\\"\\n\" +",
            "          \"EOF\",",
            "    executable = True,",
            ")",
        ]),
    )

    http_archive(
        name = "io_angular_clutz",
        build_file = str(Label("//third_party:clutz.BUILD")),
        sha256 = "b3eee38fda6b942eaf99208f9714f033974308eaeebf2300f61c828a3e1a5879",
        # An upgrade to io_bazel_rules_closure updated Closure compiler, which
        # required Clutz upgrades that are not in any release. Thus, this is
        # pinned to HEAD.
        strip_prefix = "clutz-7ef7cdb156cd5f0359eb3b22b259d780e3ad825d",
        urls = [
            "http://mirror.tensorflow.org/github.com/angular/clutz/archive/7ef7cdb156cd5f0359eb3b22b259d780e3ad825d.tar.gz",  # 2019-10-23
            "https://github.com/angular/clutz/archive/7ef7cdb156cd5f0359eb3b22b259d780e3ad825d.tar.gz",
        ],
    )

    filegroup_external(
        name = "com_google_javascript_closure_compiler_externs",
        licenses = ["notice"],
        sha256_urls_extract = {
            "4f0cc3cf9928905993072bdd1f81a4444bd8b7fff0a12f119e2dd2a9a68cdd82": [
                # tag v20190513 resolves to commit 938e347e4f79f4d7b124e160145b6ea3418b4c56 (2019-05-13 16:28:32 -0700)
                "http://mirror.tensorflow.org/github.com/google/closure-compiler/archive/v20190513.tar.gz",
                "https://github.com/google/closure-compiler/archive/v20190513.tar.gz",
            ],
        },
        strip_prefix = {"v20190513.tar.gz": "closure-compiler-20190513/externs"},
    )

    filegroup_external(
        name = "org_threejs",
        # no @license header
        licenses = ["notice"],  # MIT
        sha256_urls = {
            "90f3af9ebfaf34f642b05f3baeeca2c5547d1b8ba6872803990c26804f4067b1": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/mrdoob/three.js/r108/LICENSE",
                "https://raw.githubusercontent.com/mrdoob/three.js/r108/LICENSE",
            ],
            "545db828b1d52f926026d5f04f32dbc6f9ff7c62a2d8e2da9dfda09b155a490a": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/mrdoob/three.js/r108/build/three.js",
                "https://raw.githubusercontent.com/mrdoob/three.js/r108/build/three.js",
            ],
            "cec663b016fb04c118ac7d6d1365eb9ad81567843e6c584ade4217d4adaf0ca0": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/mrdoob/three.js/r108/examples/js/controls/OrbitControls.js",
                "https://raw.githubusercontent.com/mrdoob/three.js/r108/examples/js/controls/OrbitControls.js",
            ],
        },
    )

    ##############################################################################
    # TensorBoard JavaScript Production Dependencies

    web_library_external(
        name = "com_lodash",
        licenses = ["notice"],  # MIT
        sha256 = "6c5fa80d0fa9dc4eba634ab042404ff7c162dcb4cfe3473338801aeca0042285",
        urls = [
            "http://mirror.tensorflow.org/github.com/lodash/lodash/archive/4.17.5.tar.gz",
            "https://github.com/lodash/lodash/archive/4.17.5.tar.gz",
        ],
        strip_prefix = "lodash-4.17.5",
        path = "/lodash",
        srcs = ["lodash.js"],
        extra_build_file_content = "exports_files([\"LICENSE\"])",
    )

    filegroup_external(
        name = "com_numericjs",
        # no @license header
        licenses = ["notice"],  # MIT
        sha256_urls = {
            "0e94aada97f12dee6118064add9170484c55022f5d53206ee4407143cd36ddcd": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/sloisel/numeric/v1.2.6/license.txt",
                "https://raw.githubusercontent.com/sloisel/numeric/v1.2.6/license.txt",
            ],
            "5dcaba2016fd237091e3a17b0dc272fb21f0e2b15d7628f95a0ad0cd4cdf4020": [
                "http://mirror.tensorflow.org/cdnjs.cloudflare.com/ajax/libs/numeric/1.2.6/numeric.js",
                "https://cdnjs.cloudflare.com/ajax/libs/numeric/1.2.6/numeric.js",
            ],
        },
        rename = {"numeric-1.2.6.js": "numeric.js"},
    )

    filegroup_external(
        name = "ai_google_pair_umap_js",
        # no @license header
        licenses = ["notice"],  # Apache License 2.0
        sha256_urls = {
            "035fede477f10b909dd64a2ea01c031149ee523f54fb9bbe48a170eb04d53825": [
                "http://mirror.tensorflow.org/unpkg.com/umap-js@1.2.2/lib/umap-js.min.js",
                "https://unpkg.com/umap-js@1.2.2/lib/umap-js.min.js",
            ],
        },
    )

    filegroup_external(
        name = "com_palantir_plottable",
        # no @license header
        licenses = ["notice"],  # MIT
        sha256_urls_extract = {
            # Plottable doesn't have a release tarball on GitHub. Using the
            # sources directly from git also requires running Node tooling
            # beforehand to generate files. NPM is the only place to get it.
            "08df639782baf9b8cfeeb5fcdfbe3a1ce25b5a916903fc580e201a0a1142a6c4": [
                "http://mirror.tensorflow.org/registry.npmjs.org/plottable/-/plottable-3.7.0.tgz",
                "https://registry.npmjs.org/plottable/-/plottable-3.7.0.tgz",
            ],
        },
    )

    filegroup_external(
        name = "io_github_cpettitt_dagre",
        # no @license header
        licenses = ["notice"],  # MIT
        sha256_urls = {
            "6a349742a6cb219d5a2fc8d0844f6d89a6efc62e20c664450d884fc7ff2d6015": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/cpettitt/dagre/v0.8.2/LICENSE",
                "https://raw.githubusercontent.com/cpettitt/dagre/v0.8.2/LICENSE",
            ],
            "43cb4e919196c177c149b63880d262074670af99db6a1e174b25e266da4935a9": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/cpettitt/dagre/v0.8.2/dist/dagre.core.js",
                "https://raw.githubusercontent.com/cpettitt/dagre/v0.8.2/dist/dagre.core.js",
            ],
        },
    )

    filegroup_external(
        name = "io_github_cpettitt_graphlib",
        licenses = ["notice"],  # MIT
        sha256_urls = {
            "6a349742a6cb219d5a2fc8d0844f6d89a6efc62e20c664450d884fc7ff2d6015": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/cpettitt/graphlib/v2.1.5/LICENSE",
                "https://raw.githubusercontent.com/cpettitt/graphlib/v2.1.5/LICENSE",
            ],
            "ddc33a6aaf955ee24b0e0d30110adf350c65eedc5c0f2c424ca85bc128199a66": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/cpettitt/graphlib/v2.1.5/dist/graphlib.core.js",
                "https://raw.githubusercontent.com/cpettitt/graphlib/v2.1.5/dist/graphlib.core.js",
            ],
        },
    )

    web_library_external(
        name = "vaadin_vaadin_split_layout",
        licenses = ["notice"],  # Apache License 2.0
        sha256 = "44fb83628edb77cb8392c165d4d99734750a6fbb00e5391f033962e56f14eba3",
        urls = [
            "http://mirror.tensorflow.org/github.com/vaadin/vaadin-split-layout/archive/v1.1.0.tar.gz",
            "https://github.com/vaadin/vaadin-split-layout/archive/v1.1.0.tar.gz",
        ],
        srcs = ["vaadin-split-layout.html"],
        deps = [
            "@org_polymer",
            "@org_polymer_iron_resizable_behavior",
        ],
        strip_prefix = "vaadin-split-layout-1.1.0",
        path = "/vaadin-split-layout",
    )

    web_library_external(
        name = "vaadin_vaadin_grid",
        licenses = ["notice"],  # Apache License 2.0
        sha256 = "834679bedc1b6bafecac7e7f0e3458d99ace6cddbf154c56631ef6428b787fd1",
        urls = [
            "http://mirror.tensorflow.org/github.com/vaadin/vaadin-grid/archive/v3.0.2.tar.gz",
            "https://github.com/vaadin/vaadin-grid/archive/v3.0.2.tar.gz",
        ],
        glob = ["*.html"],
        exclude = [
            "index.html",
        ],
        deps = [
            "@org_polymer_iron_resizable_behavior",
            "@org_polymer_iron_scroll_target_behavior",
            "@org_polymer_iron_a11y_keys_behavior",
            "@org_polymer_iron_a11y_announcer",
            "@org_polymer",
        ],
        strip_prefix = "vaadin-grid-3.0.2",
        path = "/vaadin-grid",
    )

    ##############################################################################
    # TensorBoard Testing Dependencies

    web_library_external(
        name = "org_npmjs_registry_accessibility_developer_tools",
        licenses = ["notice"],  # Apache License 2.0
        sha256 = "1d6a72f401c9d53f68238c617dd43a05cd85ca5aa2e676a5b3c352711448e093",
        urls = [
            "http://mirror.tensorflow.org/registry.npmjs.org/accessibility-developer-tools/-/accessibility-developer-tools-2.10.0.tgz",
            "https://registry.npmjs.org/accessibility-developer-tools/-/accessibility-developer-tools-2.10.0.tgz",
        ],
        strip_prefix = "package",
        path = "/accessibility-developer-tools",
        suppress = ["strictDependencies"],
    )

    web_library_external(
        name = "org_npmjs_registry_async",
        licenses = ["notice"],  # MIT
        sha256 = "08655255ae810bf4d1cb1642df57658fcce823776d3ba8f4b46f4bbff6c87ece",
        urls = [
            "http://mirror.tensorflow.org/registry.npmjs.org/async/-/async-1.5.0.tgz",
            "https://registry.npmjs.org/async/-/async-1.5.0.tgz",
        ],
        strip_prefix = "package",
        path = "/async",
    )

    web_library_external(
        name = "org_npmjs_registry_chai",
        licenses = ["notice"],  # MIT
        sha256 = "aca8137bed5bb295bd7173325b7ad604cd2aeb341d739232b4f9f0b26745be90",
        urls = [
            "http://mirror.tensorflow.org/registry.npmjs.org/chai/-/chai-3.5.0.tgz",
            "https://registry.npmjs.org/chai/-/chai-3.5.0.tgz",
        ],
        strip_prefix = "package",
        path = "/chai",
    )

    web_library_external(
        name = "org_npmjs_registry_mocha",
        licenses = ["notice"],  # MIT
        sha256 = "13ef37a071196a2fba680799b906555d3f0ab61e80a7e8f73f93e77914590dd4",
        urls = [
            "http://mirror.tensorflow.org/registry.npmjs.org/mocha/-/mocha-2.5.3.tgz",
            "https://registry.npmjs.org/mocha/-/mocha-2.5.3.tgz",
        ],
        suppress = ["strictDependencies"],
        strip_prefix = "package",
        path = "/mocha",
    )

    web_library_external(
        name = "org_npmjs_registry_sinon",
        licenses = ["notice"],  # BSD-3-Clause
        sha256 = "49edb057695fc9019aae992bf7e677a07de7c6ce2bf9f9facde4a245045d1532",
        urls = [
            "http://mirror.tensorflow.org/registry.npmjs.org/sinon/-/sinon-1.17.4.tgz",
            "https://registry.npmjs.org/sinon/-/sinon-1.17.4.tgz",
        ],
        strip_prefix = "package/pkg",
        path = "/sinonjs",
    )

    web_library_external(
        name = "org_npmjs_registry_sinon_chai",
        licenses = ["notice"],  # BSD-3-Clause
        sha256 = "b85fc56f713832960b56fe9269ee4bb2cd41edd2ceb130b0936e5bdbed5dea63",
        urls = [
            "http://mirror.tensorflow.org/registry.npmjs.org/sinon-chai/-/sinon-chai-2.8.0.tgz",
            "https://registry.npmjs.org/sinon-chai/-/sinon-chai-2.8.0.tgz",
        ],
        strip_prefix = "package",
        path = "/sinon-chai",
    )

    web_library_external(
        name = "org_npmjs_registry_stacky",
        licenses = ["notice"],  # BSD-3-Clause
        sha256 = "c659e60f7957d9d80c23a7aacc4d71b19c6421a08f91174c0062de369595acae",
        urls = [
            "http://mirror.tensorflow.org/registry.npmjs.org/stacky/-/stacky-1.3.1.tgz",
            "https://registry.npmjs.org/stacky/-/stacky-1.3.1.tgz",
        ],
        strip_prefix = "package",
        path = "/stacky",
    )

    web_library_external(
        name = "org_npmjs_registry_web_component_tester",
        licenses = ["notice"],  # BSD-3-Clause
        sha256 = "9d4ebd4945df8a936916d4d32b7f280f2a3afa35f79e7ca8ad3ed0a42770c537",
        urls = [
            "http://mirror.tensorflow.org/registry.npmjs.org/web-component-tester/-/web-component-tester-4.3.6.tgz",
            "https://registry.npmjs.org/web-component-tester/-/web-component-tester-4.3.6.tgz",
        ],
        strip_prefix = "package",
        path = "/web-component-tester",
        suppress = [
            "absolutePaths",
            "strictDependencies",
        ],
        deps = [
            "@com_lodash",
            "@org_npmjs_registry_accessibility_developer_tools",
            "@org_npmjs_registry_async",
            "@org_npmjs_registry_chai",
            "@org_npmjs_registry_mocha",
            "@org_npmjs_registry_sinon",
            "@org_npmjs_registry_sinon_chai",
            "@org_npmjs_registry_stacky",
            "@org_polymer_test_fixture",
        ],
    )

    web_library_external(
        name = "org_polymer_test_fixture",
        licenses = ["notice"],  # BSD-3-Clause
        sha256 = "59d6cfb1187733b71275becfea181fe0aa1f734df5ff77f5850c806bbbf9a0d9",
        strip_prefix = "test-fixture-2.0.1",
        urls = [
            "http://mirror.tensorflow.org/github.com/PolymerElements/test-fixture/archive/v2.0.1.tar.gz",
            "https://github.com/PolymerElements/test-fixture/archive/v2.0.1.tar.gz",
        ],
        path = "/test-fixture",
        exclude = ["test/**"],
    )

    filegroup_external(
        name = "org_tensorflow_graphics_lib",
        licenses = ["notice"],  # MIT
        sha256_urls = {
            "76ebbb763969cad7f66fadf24d97a8beec6b6e9c64da568139ad739a1c46ba14": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/tensorflow/graphics/fa0fc3496d86f0235d614a5f9a27257a1898cae2/tensorflow_graphics/tensorboard/mesh_visualizer/tf_mesh_dashboard/array-buffer-data-provider.js",
                "https://raw.githubusercontent.com/tensorflow/graphics/fa0fc3496d86f0235d614a5f9a27257a1898cae2/tensorflow_graphics/tensorboard/mesh_visualizer/tf_mesh_dashboard/array-buffer-data-provider.js",
            ],
            "0e25af04903d91bb4471d2abc6035ed35c1681993a269feff32ba404a7d9bb9f": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/tensorflow/graphics/fa0fc3496d86f0235d614a5f9a27257a1898cae2/tensorflow_graphics/tensorboard/mesh_visualizer/tf_mesh_dashboard/mesh-viewer.js",
                "https://raw.githubusercontent.com/tensorflow/graphics/fa0fc3496d86f0235d614a5f9a27257a1898cae2/tensorflow_graphics/tensorboard/mesh_visualizer/tf_mesh_dashboard/mesh-viewer.js",
            ],
        },
    )

    filegroup_external(
        name = "com_google_material_design_icon",
        licenses = ["notice"],
        sha256_urls = {
            "fa4ad2661739c9ecefa121c41f5c95de878d4990ee86413124585a3af7d7dffb": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/content/svg/production/ic_content_copy_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/3.0.1/content/svg/production/ic_content_copy_24px.svg",
            ],
            "962aee2433f026ed7843790f6757dc3c25c34f349feb9b4fe816629b1b22442d": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/action/svg/production/ic_help_outline_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/3.0.1/action/svg/production/ic_help_outline_24px.svg",
            ],
            "f3d6e717a2d6fa6caec61221fb4b838663abbd1a58933dd7d2824b408932d3fe": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/action/svg/production/ic_info_outline_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/3.0.1/action/svg/production/ic_info_outline_24px.svg",
            ],
            "b4d30acd39de79f490eff59d72fb1f06502c117c8815359d539e4f20515494de": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_refresh_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_refresh_24px.svg",
            ],
            "d0872fb94037822164c8cea43a2ebeafdd1b664ff0fdc9387f0e1e1a7ee74628": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/action/svg/production/ic_settings_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/3.0.1/action/svg/production/ic_settings_24px.svg",
            ],
            "6105c83ef3637bbb1f1f8ceceacb51df818e867238ee6c49e0a8d1ca7f858b72": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/action/svg/production/ic_search_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/3.0.1/action/svg/production/ic_search_24px.svg",
            ],
            "4ab47484995ab72bd8b7175bd36273d3e8787cf3e1e28a4f695fee07e8d0884d": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/alert/svg/production/ic_error_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/3.0.1/alert/svg/production/ic_error_24px.svg",
            ],
            "ad918f7ec0ff89298e84586b5b98cdf628c8457cd067dc592031fae783f71a1d": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_chevron_left_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/224895a86501195e7a7ff3dde18e39f00b8e3d5a/navigation/svg/production/ic_chevron_left_24px.svg",
            ],
            "83f0da9735a4e475b0eca23b708ba09b2b7411e7d711b2d6be24bc2371d67ec8": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_chevron_right_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/224895a86501195e7a7ff3dde18e39f00b8e3d5a/navigation/svg/production/ic_chevron_right_24px.svg",
            ],
            "b1e7ec6fcc3a0aeefe585abd0860e60dabd39b884be8b52cd886acb3e0635ec3": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/action/svg/production/ic_visibility_off_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/224895a86501195e7a7ff3dde18e39f00b8e3d5a/action/svg/production/ic_visibility_off_24px.svg",
            ],
            "cbb30ec622923b6e0442d67277e30eaa1ba429223b132fde3289d125f2c62c88": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/content/svg/production/ic_flag_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/224895a86501195e7a7ff3dde18e39f00b8e3d5a/content/svg/production/ic_flag_24px.svg",
            ],
            "6d4ccf520d400755057a1739a66c0feda3c98bbc34e8e7f79afa630b2e43f87e": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/content/svg/production/ic_clear_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/224895a86501195e7a7ff3dde18e39f00b8e3d5a/content/svg/production/ic_clear_24px.svg",
            ],
            "f83d9a4e6a9af95c9321a34f2564e9d45483834fa17f5da5a3a403500636360a": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_expand_more_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/224895a86501195e7a7ff3dde18e39f00b8e3d5a/navigation/svg/production/ic_expand_more_24px.svg",
            ],
            "e52d4acf9d020f85e9fc674479d3ed60ccdd1aa1e6ef3b75f8cd75f1c2284030": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_expand_less_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/224895a86501195e7a7ff3dde18e39f00b8e3d5a/navigation/svg/production/ic_expand_less_24px.svg",
            ],
            "0ea7671d0b99f8245208eda58e3bc3c633f715bc8ceb9fb2cf60ea5eeda9bda9": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_cancel_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/224895a86501195e7a7ff3dde18e39f00b8e3d5a/navigation/svg/production/ic_cancel_24px.svg",
            ],
            "dd8deb85c82313c5aeb4936857fd99cb38a617507fb65afddf289941b99ae9f2": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_arrow_downward_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_arrow_downward_24px.svg",
            ],
            "76d31a5591d1044d0461ee6dc482580e9797101dc96a47bbd53cef9930777f85": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_arrow_upward_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/3.0.1/navigation/svg/production/ic_arrow_upward_24px.svg",
            ],
            "b887b20de9d7850bac7629bbc72519f5f76c1ae988c692f1970e70cec7498456": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/3.0.1/action/svg/production/ic_get_app_24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/224895a86501195e7a7ff3dde18e39f00b8e3d5a/action/svg/production/ic_get_app_24px.svg",
            ],
            "93e72d0395250e7a75c702dc0df010e6756dded05ffcebe72bb9715788518a8f": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/content/push_pin/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/content/push_pin/materialicons/24px.svg",
            ],
            "eca3a04cd5362207d925dfb9a1633e133bf4612abaa2060b840c9ebc868b958a": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/content/push_pin/materialiconsoutlined/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/content/push_pin/materialiconsoutlined/24px.svg",
            ],
            "925221f8db5bc0358834bbd61bcd082624374e3da86bc64d04db21106fe72458": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/bug_report/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/bug_report/materialicons/24px.svg",
            ],
            "b54342456d5a7f2da53795147f8af36ec76fbf5b57d792fe75f07538e6c6783e": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/close/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/close/materialicons/24px.svg",
            ],
            "f934b1a5a54e89d82cbbb334e1c7dc28d69fc779c1bec59889facd5de899e8ac": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/filter_alt/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/filter_alt/materialicons/24px.svg",
            ],
            "3e6e96299b5cb5ea6faec369d1db09313dc957ec28f56a25cbe1bbd5ac55e820": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/fullscreen/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/fullscreen/materialicons/24px.svg",
            ],
            "20f6c4f110effafe35778bba8ce3789b0c6a9c02b5a0f6bcf18c192a94e80a1d": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/fullscreen_exit/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/fullscreen_exit/materialicons/24px.svg",
            ],
            "d147e90c69c346cd82fb45f519d9cb45dd8d61ab4f5bba8156c36545d9abc62f": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/image/image_search/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/image/image_search/materialicons/24px.svg",
            ],
            "ccae3a4f752212fa288aa0035d49bc2c1d5daca78931f3065fb1e0be98d82493": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/line_weight/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/line_weight/materialicons/24px.svg",
            ],
            "4f59e208f5babcf58c07505356ca1f109a9e1972e839b991dff19f709a28eeba": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/more_vert/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/more_vert/materialicons/24px.svg",
            ],
            "a558348444b0f80697a8f343767408288ab10be989550b651404641c717c7c0f": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/settings_backup_restore/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/settings_backup_restore/materialicons/24px.svg",
            ],
            "608da1f1bba357551f222bb44512de328da8394b3c910724415b3156ebb08ca3": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/settings_overscan/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/settings_overscan/materialicons/24px.svg",
            ],
            "a9706960208156a1de89bbfca8abeffa8771ba9332fcb9605e277bfd8b4eb3b8": [
                "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/alert/warning/materialicons/24px.svg",
                "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/alert/warning/materialicons/24px.svg",
            ],
        },
        rename = {
            "ic_arrow_downward_24px.svg": "arrow_downward_24px.svg",
            "ic_arrow_upward_24px.svg": "arrow_upward_24px.svg",
            "ic_cancel_24px.svg": "cancel_24px.svg",
            "ic_chevron_left_24px.svg": "chevron_left_24px.svg",
            "ic_chevron_right_24px.svg": "chevron_right_24px.svg",
            "ic_clear_24px.svg": "clear_24px.svg",
            "ic_content_copy_24px.svg": "content_copy_24px.svg",
            "ic_error_24px.svg": "error_24px.svg",
            "ic_expand_less_24px.svg": "expand_less_24px.svg",
            "ic_expand_more_24px.svg": "expand_more_24px.svg",
            "ic_flag_24px.svg": "flag_24px.svg",
            "ic_get_app_24px.svg": "get_app_24px.svg",
            "ic_help_outline_24px.svg": "help_outline_24px.svg",
            "ic_info_outline_24px.svg": "info_outline_24px.svg",
            "ic_push_pin_24px.svg": "push_pin_24px.svg",
            "ic_push_pin_outline_24px.svg": "push_pin_outline_24px.svg",
            "ic_refresh_24px.svg": "refresh_24px.svg",
            "ic_search_24px.svg": "search_24px.svg",
            "ic_settings_24px.svg": "settings_24px.svg",
            "ic_visibility_off_24px.svg": "visibility_off_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/bug_report/materialicons/24px.svg": "bug_report_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/bug_report/materialicons/24px.svg": "bug_report_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/close/materialicons/24px.svg": "close_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/close/materialicons/24px.svg": "close_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/filter_alt/materialicons/24px.svg": "filter_alt_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/filter_alt/materialicons/24px.svg": "filter_alt_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/fullscreen/materialicons/24px.svg": "fullscreen_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/fullscreen/materialicons/24px.svg": "fullscreen_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/fullscreen_exit/materialicons/24px.svg": "fullscreen_exit_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/fullscreen_exit/materialicons/24px.svg": "fullscreen_exit_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/image/image_search/materialicons/24px.svg": "image_search_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/image/image_search/materialicons/24px.svg": "image_search_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/content/push_pin/materialicons/24px.svg": "keep_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/content/push_pin/materialicons/24px.svg": "keep_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/content/push_pin/materialiconsoutlined/24px.svg": "keep_outline_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/content/push_pin/materialiconsoutlined/24px.svg": "keep_outline_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/line_weight/materialicons/24px.svg": "line_weight_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/line_weight/materialicons/24px.svg": "line_weight_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/more_vert/materialicons/24px.svg": "more_vert_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/navigation/more_vert/materialicons/24px.svg": "more_vert_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/settings_backup_restore/materialicons/24px.svg": "settings_backup_restore_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/settings_backup_restore/materialicons/24px.svg": "settings_backup_restore_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/settings_overscan/materialicons/24px.svg": "settings_overscan_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/action/settings_overscan/materialicons/24px.svg": "settings_overscan_24px.svg",
            "http://mirror.tensorflow.org/raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/alert/warning/materialicons/24px.svg": "warning_24px.svg",
            "https://raw.githubusercontent.com/google/material-design-icons/b3f05bfbf4329a5b63f50a720f867c2bac163f98/src/alert/warning/materialicons/24px.svg": "warning_24px.svg",
        },
    )
