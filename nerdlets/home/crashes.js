import React from 'react';
import { AreaChart, BarChart, Button, LineChart, NerdGraphQuery, PlatformStateContext, Spinner, Table, TableHeader, TableHeaderCell, TableRow, TableRowCell } from 'nr1';
import Select, { components } from 'react-select';
import csvDownload from 'json-to-csv-export';
import CrashDrilldown from './crash-drilldown';

const query = require('./utils');

export default class Crashes extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      versionSelected: {'value': 'all', 'label': 'All Versions'},
      versions: [],
      filtersSelected: [],
      filters: [],
      groupSelected: {'value': 'crashLocation', 'label': 'Crash Location'},
      crashSummary: [],
      exportable: [],
      column_5: TableHeaderCell.SORTING_TYPE.DESCENDING,
      showCrashDrilldown: false,
      selectedCrash: null
    };
  }

  async componentDidMount() {
    let { appVersions, appFilters } = this.props
    await this.getCrashData();
    await this.setState({ versions: appVersions, filters: appFilters });
    await this.setState({ loading: false });
  }

  async componentDidUpdate(prevProps, prevState) {
    if (prevState.versionSelected !== this.state.versionSelected ||
        prevState.filtersSelected !== this.state.filtersSelected ||
        prevProps.time !== this.props.time) {
      await this.getCrashData();
    }
  }

  async getCrashData() {
    let { filtersSelected, versionSelected } = this.state;
    let { entity, time } = this.props;
    let filterString = '';
    let versionString = '';

    if (filtersSelected.length > 0) {
      filtersSelected.map(f => {
        let split = f.fullLabel.split(":");
        filterString += `AND ${split[0]}='${split[1]}' `;
      })
    }

    if (versionSelected.value !== 'all') {
      versionString = `AND appVersion = '${versionSelected.label}'`;
    }

    const res = await NerdGraphQuery.query({ query: query.mobileCrashes(entity.account.id, time, entity.guid, filterString, versionString)});

    if (res.error) {
      console.debug(`Failed to retrieve crash summary for entity: ${entity.name}`);
      console.debug(res.error)
    } else {
      let crashSummary = res.data.actor.account.crashTypes.results;
      let exportableData = [];

      if (crashSummary && crashSummary.length > 0) {
        exportableData = await this.getExportableData(crashSummary);
      }

      this.setState({crashSummary: crashSummary, exportable: exportableData});
    }
  }

  getExportableData(summary) {
    let formatted = [];

    for (var i=0; i<summary.length; i++) {
      let oneResult = {
        Location: summary[i].facet[0],
        Exception: summary[i].Exception,
        FirstSeen: new Date(summary[i].First).toLocaleString(),
        LastSeen: new Date(summary[i].Last).toLocaleString(),
        AppVersion: summary[i].facet[1],
        Count: summary[i].count,
        UsersAffected: summary[i]['Users Affected']
      }
      formatted.push(oneResult);
    }

    return formatted;
  }

  renderDropdowns() {
    let { filters, filtersSelected, groupSelected, showCrashDrilldown, versions, versionSelected } = this.state;

    let groups = [
      {'value': 'crashLocation', 'label': 'Crash Location'},
      {'value': 'crashMessage', 'label': 'Crash Message'},
      {'value': 'crashException', 'label': 'Crash Exception'},
      {'value': 'countryCode', 'label': 'Country Code'},
      {'value': 'device', 'label': 'Device'},
      {'value': 'osVersion', 'label': 'OS Version'},
      {'value': 'sessionId', 'label': 'Session ID'},
      {'value': 'deviceUuid', 'label': 'Device UUID'}
    ];

    const MultiValueLabel = props => { //override react-select labels component
      return (
        <components.MultiValueLabel {...props}>
          {props.data.fullLabel}
        </components.MultiValueLabel>
      );
    };

    return (
      <>
      <div style={{display: 'inline-block', marginRight: '8px'}}>
      <Select
        isDisabled={showCrashDrilldown}
        aria-label="Versions"
        closeMenuOnSelect={true}
        defaultValue={versionSelected}
        isSearchable
        options={versions}
        onChange={(e) => this.setState({ versionSelected: e })}
        menuPortalTarget={document.body}
        menuPlacement="auto"
        menuPosition="fixed"
        styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
      />
      <h5 style={{textAlign: 'center'}}>Versions</h5>
      </div>
      <div style={{display: 'inline-block', marginRight: '8px', width: '300px'}}>
      <Select
        aria-label="Filters"
        components={{ MultiValueLabel }}
        closeMenuOnSelect={false}
        placeholder='Filter...'
        isSearchable
        isMulti
        options={filters}
        onChange={(e) => this.setState({ filtersSelected: e })}
        menuPortalTarget={document.body}
        menuPlacement="auto"
        menuPosition="fixed"
        styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
      />
      <h5 style={{textAlign: 'center'}}>Filters</h5>
      </div>
      <div style={{display: 'inline-block', marginRight: '8px'}}>
      <Select
        isDisabled={showCrashDrilldown}
        aria-label="Groups"
        closeMenuOnSelect={true}
        defaultValue={groupSelected}
        isSearchable
        options={groups}
        onChange={(e) => this.setState({ groupSelected: e })}
        menuPortalTarget={document.body}
        styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
      />
      <h5 style={{textAlign: 'center'}}>Group by</h5>
      </div>
      </>
    );
  }

  _onClickTableHeaderCell(key, event, sortingData) {
    this.setState({ [key]: sortingData.nextSortingType });
  }

  openCrashDrilldown(i) {
    this.setState({showCrashDrilldown: true, selectedCrash: i});
  }


  renderData() {
    let { crashSummary, exportable, filters, filtersSelected, groupSelected, versions, versionSelected } = this.state;
    let { entity, time } = this.props;
    let filterString = '';
    let versionString = '';
    let versionIdString = '';

    const headers = [
      {key: 'Location', value: ({ item }) => item.facet[0]},
      {key: 'Exception', value: ({ item }) => item.Exception},
      {key: 'First', value: ({ item }) => item.First},
      {key: 'Last', value: ({ item }) => item.Last},
      {key: 'App Version', value: ({ item }) => item.facet[1]},
      {key: 'Count', value: ({ item }) => item.count},
      {key: 'Users Affected', value: ({ item }) => item['Users Affected']}
    ];

    if (filtersSelected.length > 0) {
      filtersSelected.map(f => {
        let split = f.fullLabel.split(":");
        filterString += `AND ${split[0]}='${split[1]}' `;
      })
    }

    if (versionSelected.value !== 'all') {
      versionString = `AND appVersion = '${versionSelected.label}'`;
      versionIdString = `AND appVersionId = ${versionSelected.value}`
    }

    let totals = `FROM Mobile SELECT filter(count(*), where category = 'Crash') as 'Total' facet ${groupSelected.value} where entityGuid = '${entity.guid}' ${versionString} ${filterString} ${time}`;
    let crashRate = `SELECT percentage(uniqueCount(sessionId), WHERE category = 'Crash') as 'Crash rate' FROM MobileSession, MobileCrash WHERE (entityGuid = '${entity.guid}' ${versionIdString}) WHERE crashFingerprint NOT IN ('320ef1a65b5720cb224bcd17d9dc313a-1387962-99484684') ${filterString} TIMESERIES ${time} LIMIT 1000`;
    let crashFreeUsers = `SELECT (1-filter(uniqueCount(uuid), WHERE category='Crash') / uniqueCount(uuid)) * 100 as 'Crash-free users' FROM MobileSession, MobileCrash WHERE (entityGuid = '${entity.guid}' ${versionIdString}) WHERE crashFingerprint NOT IN ('320ef1a65b5720cb224bcd17d9dc313a-1387962-99484684') ${filterString} TIMESERIES ${time} LIMIT 1000`;
    let topGroup = `SELECT count(*) FROM MobileCrash WHERE (entityGuid = '${entity.guid}' ${versionIdString}) WHERE crashFingerprint NOT IN ('320ef1a65b5720cb224bcd17d9dc313a-1387962-99484684') ${filterString} FACET ${groupSelected.value} TIMESERIES ${time} LIMIT 5`;

    return (
      <div>
        <div style={{width: '45%', marginTop: '30px', display: 'inline-block', marginRight: '20px'}}>
          <h4>Crash Counts</h4>
          <BarChart
            accountIds={[entity.account.id]}
            query={totals}
            fullWidth
            style={{display: 'inline-block'}}
          />
        </div>
        <div style={{width: '25%', marginTop: '30px', display: 'inline-block', marginRight: '20px'}}>
          <h4>Crash Rate</h4>
          <LineChart
            accountIds={[entity.account.id]}
            query={crashRate}
            fullWidth
            style={{display: 'inline-block'}}
          />
        </div>
        <div style={{width: '25%', marginTop: '30px', display: 'inline-block'}}>
          <h4>Crash-Free Users</h4>
          <AreaChart
            accountIds={[entity.account.id]}
            query={crashFreeUsers}
            fullWidth
            style={{display: 'inline-block'}}
          />
        </div>
        <br />
        <div style={{width: '100%', marginTop: '50px'}}>
          <h4>{`Top ${groupSelected.label}s`}</h4>
          <AreaChart
            accountIds={[entity.account.id]}
            query={topGroup}
            fullWidth
            style={{display: 'inline-block'}}
          />
        </div>
        <div style={{width: '100%', marginTop: '50px'}}>
        {
          crashSummary.length > 0
          ?
          <>
          <h4>{`Crash Types (${crashSummary.length})`}</h4>
          <Button
            className="export"
            onClick={() => csvDownload({data: exportable, filename: 'crashes.csv'})}
            type={Button.TYPE.PRIMARY}
            iconType={Button.ICON_TYPE.INTERFACE__OPERATIONS__EXPORT}
          >
            Export
          </Button>
          <Table items={crashSummary}>
            <TableHeader>
              {headers.map((h, i) => (
                <TableHeaderCell
                {...h}
                width="fit-content"
                sortable
                sortingType={this.state[`column_${i}`]}
                onClick={this._onClickTableHeaderCell.bind(this, `column_${i}`)}
                >
                {h.key}
                </TableHeaderCell>
              ))}
            </TableHeader>

            {({ item }) => {
              return (
                <TableRow>
                  <TableRowCell value={item} onClick={() => this.openCrashDrilldown(item)}><a>{item.facet[0]}</a></TableRowCell>
                  <TableRowCell>{item.Exception}</TableRowCell>
                  <TableRowCell>{new Date(item.First).toLocaleString()}</TableRowCell>
                  <TableRowCell>{new Date(item.Last).toLocaleString()}</TableRowCell>
                  <TableRowCell>{item.facet[1]}</TableRowCell>
                  <TableRowCell>{item.count}</TableRowCell>
                  <TableRowCell>{item['Users Affected']}</TableRowCell>
                </TableRow>
              );
            }}
          </Table>
          </>
          :
          <p>No crashes matching the filters provided</p>
        }
        </div>
      </div>
    )
  }

  render() {
    let { filtersSelected, loading, showCrashDrilldown, selectedCrash } = this.state;

    if (loading) {
      return <Spinner />
    } else {
      return (
        <div>
          {this.renderDropdowns()}
          {!showCrashDrilldown &&
            <>
            <br />
            {this.renderData()}
            </>
          }
          {showCrashDrilldown && <button style={{float: 'right'}} type="button" onClick={() => this.setState({ showCrashDrilldown: !showCrashDrilldown, selectedCrash: null })}>Back to Crashes</button>}
          {showCrashDrilldown && <CrashDrilldown rawTime={this.props.rawTime} entity={this.props.entity} selected={selectedCrash} time={this.props.time} filters={filtersSelected}/>}
        </div>
      );
    }
  }
}
