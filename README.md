# goodkey-win-signtool-action

Automate code signing with Windows signtool using GoodKey service as the
cryptographic provider.

## Features

- Automates code signing for Windows applications.
- Uses the GoodKey service for secure and efficient signing.
- Supports timestamping and additional certificate inclusion.
- Configurable through various inputs for flexibility.

## Inputs

| Name                         | Description                                                                | Required | Default  |
| ---------------------------- | -------------------------------------------------------------------------- | -------- | -------- |
| `organization`               | The organization identifier.                                               | Yes      |          |
| `token`                      | The GoodKey API token.                                                     | Yes      |          |
| `certificate`                | SHA-1 thumbprint of the certificate to use for signing.                    | Yes      |          |
| `file`                       | The file to sign.                                                          | Yes      |          |
| `timestamp_url`              | The URL of the timestamp server.                                           | No       | ""       |
| `timestamp_rfc3161_url`      | The URL of the RFC 3161 timestamp server.                                  | No       | ""       |
| `timestamp_digest_algorithm` | Specifies the timestamp digest algorithm to use for creating timestamps.   | No       | ""       |
| `description`                | Specifies a description of the signed content.                             | No       | ""       |
| `description_url`            | Specifies a URL for the expanded description of the signed content.        | No       | ""       |
| `additional_certificates`    | List of additional certificates to include in the signature in PEM format. | No       | ""       |
| `file_digest_algorithm`      | Specifies the file digest algorithm to use for creating file signatures.   | No       | "sha256" |
| `version`                    | Specifies the version of the signtool artifacts.   | No       | "latest" |

## Usage

Here's an example of how to use this action in your GitHub workflow:

```yaml
name: Code Signing

on: [push]

jobs:
  sign:
    runs-on: windows-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Run the action
        uses: peculiarventures/goodkey-win-signtool-action
        with:
          organization: ${{ secrets.ORGANIZATION }}
          token: ${{ secrets.TOKEN }}
          certificate: "224b501264c1454d4627268297670451aed3b0d9"
          file: "wmi.dll"
          timestamp_rfc3161_url: "http://timestamp.digicert.com"
          timestamp_digest_algorithm: "sha256"
          description: "This is a test file"
          description_url: "https://example.com"
          file_digest_algorithm: "sha256"
          additional_certificates: |
            -----BEGIN CERTIFICATE-----
            ...
            -----END CERTIFICATE-----
            -----BEGIN CERTIFICATE-----
            ...
            -----END CERTIFICATE-----
```

## License

This project is licensed under the [Apache 2.0 License](LICENSE).
