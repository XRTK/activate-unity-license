# activate-unity-license

An atomic GitHub Action that activates the Unity Engine license via cli with the provided secret parameters.

Part of the [Mixed Reality Toolkit (XRTK)](https://github.com/XRTK) open source project.

> This action does not require the use of XRTK in your Unity project.

## Related Github Actions

* [xrtk/unity-setup](https://github.com/XRTK/unity-setup) Downloads and installs the unity editor.
* [xrtk/unity-action](https://github.com/XRTK/unity-action) An cli tool for passing commands to the Unity Engine.
* [xrtk/unity-build](https://github.com/XRTK/unity-build) ***(Requires XRTK plugin in Unity Project)***

## How to use

This action uses your stored environment secrets to authenticate with the Unity Licensing servers.

***It's important that you disable other forks of your repository to run actions in pull requests from unknown contributors.***

> Read more on [Approving workflow runs from public forks](
https://docs.github.com/en/actions/managing-workflow-runs/approving-workflow-runs-from-public-forks)

[![Managing GitHub Actions settings for a repository](RecommendedSecuritySettings.png)](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)

### Setup Secrets

This action requires several secrets that need to be setup in the repository or organization's action secret store.

* `UNITY_USERNAME` The email address you use for your Unity Id
* `UNITY_PASSWORD` The password you use for Unity Id access
* `UNITY_SERIAL` Optional, but required for pro/plus activations
* `UNITY_2FA_KEY` Optional, but required for personal activations [2FA Auth Key Setup Steps](#2fa-auth-key-setup-steps)

> Don't forget that pro/plus licenses only support 2 active licenses at a time!

### Create Workflow file

```yml
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      max-parallel: 2 # Use this if you're activating pro license with matrix
      matrix:
        include:
          - os: ubuntu-latest
            build-targets: StandaloneLinux64
          - os: windows-latest
            build-targets: StandaloneWindows64
          - os: macos-latest
            build-targets: StandaloneOSX

    steps:
      - name: checkout self
        uses: actions/checkout@v4

        # Installs the Unity Editor based on your project version text file
        # sets -> env.UNITY_EDITOR_PATH
        # sets -> env.UNITY_PROJECT_PATH
        # https://github.com/XRTK/unity-setup
      - uses: xrtk/unity-setup@v7.2
        with:
          build-targets: ${{ matrix.build-target }}

        # Activates the installation with the provided credentials
      - uses: xrtk/activate-unity-license@v5.1
        with:
          # Required
          username: ${{ secrets.UNITY_USERNAME }}
          password: ${{ secrets.UNITY_PASSWORD }}
          # Optional
          license-type: 'Professional' # Chooses license type to use [ Personal, Professional ]
          serial: ${{ secrets.UNITY_SERIAL }} # Required for pro/plus activations
          auth-key: ${{ secrets.UNITY_2FA_KEY }} # required for personal activations
```

### 2FA Auth Key Setup Steps

To activate new two factor authentication for your Unity account:

1. Login to Unity account and navigate to `Security`
2. Click `+` (activate) next to `Two Factor Authentication`
3. Select `Start setup`
4. Input password if prompted
5. Select `Authenticator App` to receive codes, then `Next`
6. Click `Can't Scan the barcode?`
7. Copy the 16 character key
8. Create new secret `UNITY_2FA_KEY` and save the generated key from the previous step
9. Scan the QR code in your Authenticator app and verify the code.
