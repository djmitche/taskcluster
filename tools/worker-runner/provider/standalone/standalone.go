package standalone

import (
	"fmt"

	tcurls "github.com/taskcluster/taskcluster-lib-urls"
	taskcluster "github.com/taskcluster/taskcluster/v30/clients/client-go"
	"github.com/taskcluster/taskcluster/v30/internal/workerproto"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/cfg"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/provider/provider"
	"github.com/taskcluster/taskcluster/v30/tools/worker-runner/run"
)

type standaloneProviderConfig struct {
	RootURL      string
	ClientID     string
	AccessToken  string
	WorkerPoolID string
	WorkerGroup  string
	WorkerID     string
}

type StandaloneProvider struct {
	runnercfg *cfg.RunnerConfig
}

func (p *StandaloneProvider) ConfigureRun(state *run.State) error {
	var pc standaloneProviderConfig
	err := p.runnercfg.Provider.Unpack(&pc)
	if err != nil {
		return err
	}

	state.SetAccess(run.Access{
		RootURL: tcurls.NormalizeRootURL(pc.RootURL),
		Credentials: taskcluster.Credentials{
			ClientID:    pc.ClientID,
			AccessToken: pc.AccessToken,
		},
	})

	state.SetIdentity(run.Identity{
		WorkerPoolID: pc.WorkerPoolID,
		WorkerGroup:  pc.WorkerGroup,
		WorkerID:     pc.WorkerID,
	})

	workerLocation := map[string]string{
		"cloud": "standalone",
	}

	if wl, ok := p.runnercfg.Provider.Data["workerLocation"]; ok {
		for k, v := range wl.(map[string]interface{}) {
			workerLocation[k], ok = v.(string)
			if !ok {
				return fmt.Errorf("workerLocation value %s is not a string", k)
			}
		}
	}
	state.SetWorkerLocation(workerLocation)

	if providerMetadata, ok := p.runnercfg.Provider.Data["providerMetadata"]; ok {
		for k, v := range providerMetadata.(map[string]interface{}) {
			state.UpdateProviderMetadata(k, v)
		}
	}

	return nil
}

func (p *StandaloneProvider) UseCachedRun(run *run.State) error {
	return nil
}

func (p *StandaloneProvider) SetProtocol(proto *workerproto.Protocol) {
}

func (p *StandaloneProvider) WorkerStarted(state *run.State) error {
	return nil
}

func (p *StandaloneProvider) WorkerFinished(state *run.State) error {
	return nil
}

func New(runnercfg *cfg.RunnerConfig) (provider.Provider, error) {
	return &StandaloneProvider{runnercfg}, nil
}

func Usage() string {
	return `
The providerType "standalone" is intended for workers that have all of their
configuration pre-loaded.  Such workers do not interact with the worker manager.
This is not a recommended configuration - prefer to use the static provider.

It requires the following properties be included explicitly in the runner
configuration:

` + "```yaml" + `
provider:
    providerType: standalone
    rootURL: ..  # note the Golang spelling with capitalized "URL"
    clientID: .. # ..and similarly capitalized ID
    accessToken: ..
    workerPoolID: ..
    workerGroup: ..
    workerID: ..
	# (optional) custom provider-metadata entries to be passed to worker
	providerMetadata: {prop: val, ..}
    # (optional) custom properties for TASKCLUSTER_WORKER_LOCATION
	# (values must be strings)
    workerLocation:  {prop: val, ..}
` + "```" + `

The [$TASKCLUSTER_WORKER_LOCATION](https://docs.taskcluster.net/docs/manual/design/env-vars#taskcluster_worker_location)
defined by this provider has the following fields:

* cloud: standalone

as well as any worker location values from the configuration.
`
}
