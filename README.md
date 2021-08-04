# up-dock-action

<p align="left">
  <a href="https://github.com/ItsVeryWindy/up-dock-action"><img alt="GitHub Actions status" src="https://github.com/ItsVeryWindy/up-dock-action/workflows/build/badge.svg"></a>
  <a href="https://github.com/ItsVeryWindy/up-dock-action"><img alt="GitHub Actions status" src="https://github.com/ItsVeryWindy/up-dock-action/workflows/release/badge.svg"></a>
</p>

This action executes [up-dock](https://github.com/ItsVeryWindy/up-dock) to keep your docker images up to date, it will:

- download up-dock
- store it in a cache on the runner
- pass parameters from the github action to the executable

# Usage

See [action.yml](action.yml)

Basic:
> Targets same repository using a pre-existing up-dock.json file already in the repository.
```yaml
steps:
- uses: ItsVeryWindy/up-dock-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```
User Wide:
> Targets user's repositories with an inline config their own email.
```yaml
steps:
- uses: ItsVeryWindy/up-dock-action@v1
  with:
    email: 'ItsVeryWindy@users.noreply.github.com'
    search: 'user:ItsVeryWindy'
    github-token: ${{ secrets.GITHUB_TOKEN }}
    config: |
      {
        "templates": ["mcr.microsoft.com/dotnet/core/sdk:{v}"]
      }
```
Authentication for third part repositories:
> Targets same repository using a pre-existing up-dock.json file already in the repository. Include credentials for an AWS ecr registory.
```yaml
steps:
- uses: ItsVeryWindy/up-dock-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    authentication: |
      {
        "aws_account_id.dkr.ecr.region.amazonaws.com": {
          "username": "AWS",
          "password": "${{ steps.ecr_login.outputs.password }}"
        }
      }
```
