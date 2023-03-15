import React from 'react';
import { AreaChart, BillboardChart, LineChart, NerdGraphQuery, Spinner, TableChart, Tabs, TabsItem } from 'nr1';
import Crashes from './crashes';
import Exceptions from './exceptions';
import HttpErrors from './httpErrors';
import Select from 'react-select';

const query = require('./utils');

export default class Overview extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      versionSelected: {'value': 'all', 'label': 'All Versions'},
      versions: [],
      filters: [],
      exceptionFilters: [],
      httpFilters: []
    };
  }

  async componentDidMount() {
    await this.getData();
    await this.setState({ loading: false });
  }

  async getData() {
    let { entity, time } = this.props;
    let versionMatrix = [{'value': 'all', 'label': 'All Versions'}];
    let filterGroups = [];
    let exceptionGroups = [];
    let httpGroups = [];

    const res = await NerdGraphQuery.query({ query: query.mobileData(entity.account.id, time, entity.guid)});

    if (res.error) {
      console.debug(`Failed to retrieve mobile data for entity: ${entity.name}`);
      console.debug(res.error);
      console.debug(res);
    } else {
      let versions = res.data.actor.account.mobileVersions.results;
      let filters = res.data.actor.account.mobileFilters.results;
      let exceptionFilters = res.data.actor.account.mobileExceptionFilters.results;
      let httpFilters = res.data.actor.account.mobileHttpFilters.results;

      if (versions.length > 0) {
        versions.map(v => {
          versionMatrix.push({'value': v.facet[1], 'label': v.facet[0]});
        })
      }

      if (filters.length > 0) {
        filters.map(f => {
          Object.keys(f).map(key => {
            let formattedKey = key.substring(8);
            let aSingleGroup = [];
            f[key].map(val => {
              aSingleGroup.push({value: val, label: val, fullLabel: `${formattedKey}:${val}`});
            })
            filterGroups.push({label: formattedKey, options: aSingleGroup});
          })
        })
      }

      if (exceptionFilters.length > 0) {
        exceptionFilters.map(f => {
          Object.keys(f).map(key => {
            let formattedExceptionKey = key.substring(8);
            let aSingleExceptionGroup = [];
            f[key].map(val => {
              aSingleExceptionGroup.push({value: val, label: val, fullLabel: `${formattedExceptionKey}:${val}`});
            })
            exceptionGroups.push({label: formattedExceptionKey, options: aSingleExceptionGroup});
          })
        })
      }

      if (httpFilters.length > 0) {
        httpFilters.map(f => {
          Object.keys(f).map(key => {
            let formattedHttpKey = key.substring(8);
            let aSingleHttpGroup = [];
            f[key].map(val => {
              aSingleHttpGroup.push({value: val, label: val, fullLabel: `${formattedHttpKey}:${val}`});
            })
            httpGroups.push({label: formattedHttpKey, options: aSingleHttpGroup});
          })
        })
      }

      this.setState({ versions: versionMatrix, filters: filterGroups, exceptionFilters: exceptionGroups, httpFilters: httpGroups });
    }
  }

  renderVersionDropdown() {
    let { versions, versionSelected } = this.state;

    let width = (8 * versionSelected.label.length) + 50;

    return (
      <div style={{display: 'inline-block'}}>
      <Select
        aria-label="Versions"
        closeMenuOnSelect={true}
        defaultValue={versionSelected}
        isSearchable
        options={versions}
        onChange={(e) => this.setState({ versionSelected: e })}
      />
      <h5 style={{textAlign: 'center'}}>Versions</h5>
      </div>
    );
  }

  renderSummary() {
    let { versionSelected } = this.state;
    let { entity, time } = this.props;
    let crashesNrql = null;
    let crashesTimeseriesNrql = null;
    let httpErrorsNrql = null;
    let httpResponseTimeNrql = null;
    let appLaunchesNrql = null;
    let frequentInteractionsNrql = null

    if (versionSelected.value == 'all') {
      crashesNrql = `SELECT percentage(uniqueCount(uuid), WHERE category = 'Crash') AS 'Crash Rate' FROM Mobile WHERE entityGuid = '${entity.guid}' ${time}`;
      crashesTimeseriesNrql = `SELECT count(*) FROM MobileCrash WHERE (entityGuid = '${entity.guid}') FACET appVersion LIMIT 5 ${time} TIMESERIES`;
      httpErrorsNrql = `SELECT filter(average(newrelic.timeslice.value), WHERE (metricTimesliceName = 'Mobile/FailedCallRate')) AS 'Network failures', filter(average(newrelic.timeslice.value), WHERE (metricTimesliceName = 'Mobile/StatusErrorRate')) AS 'HTTP errors' FROM Metric WHERE (entityGuid = '${entity.guid}') LIMIT 1000 ${time} TIMESERIES`;
      httpResponseTimeNrql = `SELECT average(newrelic.timeslice.value) * 1000 FROM Metric WHERE (entityGuid = '${entity.guid}') FACET requestDomain LIMIT 5 ${time} WITH METRIC_FORMAT 'External/{requestDomain}/all' TIMESERIES`;
      appLaunchesNrql = `SELECT count(newrelic.timeslice.value) FROM Metric WHERE (entityGuid = '${entity.guid}') AND (metricTimesliceName = 'Session/Start') FACET instanceName LIMIT 5 ${time} TIMESERIES`;
      frequentInteractionsNrql = `FROM Mobile SELECT count(*) as 'Count', average(interactionDuration) as 'Avg Duration (ms)' where entityGuid = '${entity.guid}' facet name ${time} LIMIT 5`
    } else {
      let numericId = Number(versionSelected.value);
      crashesNrql = `SELECT percentage(uniqueCount(uuid), WHERE category = 'Crash') AS 'Crash Rate' FROM Mobile WHERE entityGuid = '${entity.guid}' and appVersion = '${versionSelected.label}' ${time}`
      crashesTimeseriesNrql = `SELECT count(*) FROM MobileCrash WHERE (entityGuid = '${entity.guid}') and (appVersion = '${versionSelected.label}') FACET appVersion LIMIT 5 ${time} TIMESERIES`;
      httpErrorsNrql = `SELECT filter(average(newrelic.timeslice.value), WHERE (metricTimesliceName = 'Mobile/FailedCallRate')) AS 'Network failures', filter(average(newrelic.timeslice.value), WHERE (metricTimesliceName = 'Mobile/StatusErrorRate')) AS 'HTTP errors' FROM Metric WHERE (entityGuid = '${entity.guid}') and (realAgentId = ${numericId}) LIMIT 1000 ${time} TIMESERIES`;
      httpResponseTimeNrql = `SELECT average(newrelic.timeslice.value) * 1000 FROM Metric WHERE (entityGuid = '${entity.guid}') and (realAgentId = ${numericId}) FACET requestDomain LIMIT 5 ${time} WITH METRIC_FORMAT 'External/{requestDomain}/all' TIMESERIES`;
      appLaunchesNrql = `SELECT count(newrelic.timeslice.value) FROM Metric WHERE (entityGuid = '${entity.guid}') AND (realAgentId = ${numericId}) AND (metricTimesliceName = 'Session/Start') FACET instanceName LIMIT 5 ${time} TIMESERIES`;
      frequentInteractionsNrql = `FROM Mobile SELECT count(*) as 'Count', average(interactionDuration) as 'Avg Duration (ms)' where entityGuid = '${entity.guid}' and (appVersion = '${versionSelected.label}') facet name ${time} LIMIT 5`
    }

    return (
      <div>
      {this.renderVersionDropdown()}
      <br />
      <div style={{marginTop: '4px', display: 'inline-block'}}>
        <BillboardChart
        accountIds={[entity.account.id]}
        query={crashesNrql}
        />
      </div>
      <div style={{display:'inline-block', width: '80%'}}>
        <h4 style={{marginTop: '4px'}}>Crashes by app version</h4>
        <AreaChart
        accountIds={[entity.account.id]}
        query={crashesTimeseriesNrql}
        fullWidth
        style={{marginBottom: '4px', display: 'inline-block'}}
        />
      </div>
      <br />
      <div className="summary">
        <h4>HTTP errors and network failure rate</h4>
        <AreaChart
        accountIds={[entity.account.id]}
        query={httpErrorsNrql}
        style={{display: 'inline-block', width: '98%'}}
        />
      </div>
      <div className="summary">
        <h4>HTTP Response Time</h4>
        <LineChart
        accountIds={[entity.account.id]}
        query={httpResponseTimeNrql}
        style={{display: 'inline-block', width: '100%'}}
        />
      </div>
      <h4 style={{marginTop: '4px'}}>App Launches</h4>
      <AreaChart
      accountIds={[entity.account.id]}
      query={appLaunchesNrql}
      fullWidth
      style={{marginTop: '4px', marginBottom: '4px'}}
      />
      <h4>Most frequent interactions</h4>
      <TableChart
      accountIds={[entity.account.id]}
      query={frequentInteractionsNrql}
      fullWidth
      />
      </div>
    )
  }


  render() {
    let { loading, versions, exceptionFilters, filters, httpFilters } = this.state;

    if (loading) {
      return <Spinner />
    } else {
      return (
        <Tabs defaultValue="summary">
          <TabsItem value="summary" label="Summary">
            {this.renderSummary()}
          </TabsItem>
          <TabsItem value="crashes" label="Crashes">
            <Crashes time={this.props.time} rawTime={this.props.rawTime} entity={this.props.entity} appVersions={versions} appFilters={filters} />
          </TabsItem>
          <TabsItem value="exceptions" label="Handled Exceptions">
            <Exceptions time={this.props.time} rawTime={this.props.rawTime} entity={this.props.entity} appVersions={versions} appFilters={exceptionFilters} />
          </TabsItem>
          <TabsItem value="httpErrors" label="HTTP Errors">
            <HttpErrors time={this.props.time} rawTime={this.props.rawTime} entity={this.props.entity} appVersions={versions} appFilters={httpFilters} />
          </TabsItem>
        </Tabs>
      );
    }
  }
}
