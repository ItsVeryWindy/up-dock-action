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
Authentication for third party repositories:
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
Caching:
> Enables caching which will store the results of the current run to be used in the next one.
```yaml
steps:
- uses: ItsVeryWindy/up-dock-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    cache: true
```

Reporting:
> An example of advanced reporting, the output of which pull requests are created can be piped into other actions. In this example, it's creating a matrix that is then used to create issues in jira. I haven't tested this so it will be good it know if it works!
```yaml
name: run up-dock
jobs:
  updock_job:
    outputs: 
      matrix: ${{ steps.updock.outputs.report }}
    runs-on: [ubuntu-latest]
    steps:
      - name: run up dock
        uses: ItsVeryWindy/up-dock-action@v1
        id: updock
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          report: true
  jira_job:
    needs: [updock_job]
    runs-on: [ubuntu-latest]
    strategy:
      matrix: ${{fromJson(needs.updock_job.outputs.matrix)}}
    steps:
      - name: Create
        id: create
        uses: atlassian/gajira-create@master
        with:
          project: GA
          issuetype: Build
          summary: |
            PR created for ${{ matrix.title }} with ${{ matrix.url }}
          description: |
            Compare branch
          fields: '{"customfield_10171": "test"}'
```
