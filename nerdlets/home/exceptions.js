import React from 'react';
import { AreaChart, BarChart, Button, LineChart, NerdGraphQuery, PlatformStateContext, PieChart, Spinner, Table, TableHeader, TableHeaderCell, TableRow, TableRowCell } from 'nr1';
import Select, { components } from 'react-select';
import csvDownload from 'json-to-csv-export';
import ExceptionDrilldown from './exception-drilldown';

const query = require('./utils');

export default class Exceptions extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      versionSelected: {'value': 'all', 'label': 'All Versions'},
      versions: [],
      filtersSelected: [],
      filters: [],
      groupSelected: {'value': 'exceptionLocation', 'label': 'Exception Location'},
      exceptionSummary: [],
      exportable: [],
      column_4: TableHeaderCell.SORTING_TYPE.DESCENDING,
      showExceptionDrilldown: false,
      selectedException: null
    };
  }

  async componentDidMount() {
    let { appVersions, appFilters } = this.props
    await this.getExceptionData();
    await this.setState({ versions: appVersions, filters: appFilters });
    await this.setState({ loading: false });
  }

  async componentDidUpdate(prevProps, prevState) {
    if (prevState.versionSelected !== this.state.versionSelected ||
        prevState.filtersSelected !== this.state.filtersSelected ||
        prevProps.time !== this.props.time) {
      await this.getExceptionData();
    }
  }

  async getExceptionData() {
    let { filtersSelected, versionSelected } = this.state;
    let { entity, time } = this.props;
    let filterString = '';
    let versionString = '';
    let exceptionSummary = [];

    if (filtersSelected.length > 0) {
      filtersSelected.map(f => {
        let split = f.fullLabel.split(":");
        filterString += `AND ${split[0]}='${split[1]}' `;
      })
    }

    if (versionSelected.value !== 'all') {
      versionString = `AND appVersion = '${versionSelected.label}'`;
    }

    const res = await NerdGraphQuery.query({ query: query.mobileExceptions(entity.account.id, time, entity.guid, filterString, versionString)});

    if (res.error) {
      console.debug(`Failed to retrieve exception summary for entity: ${entity.name}`);
      console.debug(res.error);
    } else {
      exceptionSummary = res.data.actor.account.exceptionTypes.results;
      let exportableData = [];

      let formattedExceptions = await this.formatTable(exceptionSummary);

      if (formattedExceptions && formattedExceptions.length > 0) {
        exportableData = await this.getExportableData(formattedExceptions);
      }

      this.setState({exceptionSummary: formattedExceptions, exportable: exportableData});
    }
  }

  formatTable(e) {
    if (e.length > 0) {
      for (var k=0; k < e.length; k++) {
        if (e[k].message == null) {
          e[k].message = '';
        }
      }
      return e;
    }
  }

  getExportableData(summary) {
    let formatted = [];

    for (var i=0; i<summary.length; i++) {
      let oneResult = {
        Location: summary[i].exceptionLocation,
        Exception: summary[i].message,
        VersionsAffected: summary[i]['Versions Affected'],
        Occurrences: summary[i].count,
        UsersAffected: summary[i]['Users Affected']
      }
      formatted.push(oneResult);
    }

    return formatted;
  }

  renderDropdowns() {
    let { filters, filtersSelected, groupSelected, showExceptionDrilldown, versions, versionSelected } = this.state;

    let groups = [
      {'value': 'exceptionLocation', 'label': 'Exception Location'},
      {'value': 'exceptionMessage', 'label': 'Exception Message'},
      {'value': 'exceptionName', 'label': 'Exception Name'},
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
        isDisabled={showExceptionDrilldown}
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
        isDisabled={showExceptionDrilldown}
        aria-label="Groups"
        closeMenuOnSelect={true}
        defaultValue={groupSelected}
        isSearchable
        options={groups}
        onChange={(e) => this.setState({ groupSelected: e })}
        menuPortalTarget={document.body}
        menuPlacement="auto"
        menuPosition="fixed"
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

  openExceptionDrilldown(i) {
    this.setState({showExceptionDrilldown: true, selectedException: i});
  }

  renderData() {
    let { exceptionSummary, exportable, filters, filtersSelected, groupSelected, versions, versionSelected } = this.state;
    let { entity, time } = this.props;
    let filterString = '';
    let versionString = '';
    let versionIdString = '';

    const headers = [
      {key: 'Location', value: ({ item }) => item.exceptionLocation},
      {key: 'Exception', value: ({ item }) => item.message},
      {key: 'Versions Affected', value: ({ item }) => item['Versions Affected']},
      {key: 'Occurrences', value: ({ item }) => item.count},
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

    let totals = `FROM MobileHandledException SELECT count(*) as 'Total' where entityGuid = '${entity.guid}' ${versionString} ${filterString} facet ${groupSelected.value} ${time} LIMIT 100`;
    let usersAffected = `SELECT percentage(uniqueCount(uuid), WHERE exceptionLocation IS NOT NULL ) AS 'Users Affected' FROM MobileSession, MobileHandledException WHERE (entityGuid = '${entity.guid}' ${versionString}) ${filterString} TIMESERIES ${time} LIMIT 1000`;
    let sessionsAffected = `SELECT percentage(uniqueCount(sessionId), WHERE exceptionLocation IS NOT NULL ) AS 'Sessions Affected' FROM MobileSession, MobileHandledException WHERE (entityGuid = '${entity.guid}' ${versionIdString}) ${filterString} TIMESERIES ${time} LIMIT 1000`;
    let topGroup = `SELECT count(*) FROM MobileHandledException WHERE (entityGuid = '${entity.guid}' ${versionIdString}) FACET ${groupSelected.value} ${time} TIMESERIES LIMIT 5`;

    return (
      <div>
        <div style={{width: '45%', marginTop: '30px', display: 'inline-block', marginRight: '20px'}}>
          <h4>Exception Counts</h4>
          <BarChart
            accountIds={[entity.account.id]}
            query={totals}
            fullWidth
            style={{display: 'inline-block'}}
          />
        </div>
        <div style={{width: '25%', marginTop: '30px', display: 'inline-block', marginRight: '20px'}}>
          <h4>Users affected</h4>
          <LineChart
            accountIds={[entity.account.id]}
            query={usersAffected}
            fullWidth
            style={{display: 'inline-block'}}
          />
        </div>
        <div style={{width: '25%', marginTop: '30px', display: 'inline-block'}}>
          <h4>Sessions affected</h4>
          <AreaChart
            accountIds={[entity.account.id]}
            query={sessionsAffected}
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
          exceptionSummary.length > 0
          ?
          <>
          <h4>{`Exception Types (${exceptionSummary.length})`}</h4>
          <Button
            className="export"
            onClick={() => csvDownload({data: exportable, filename: 'exceptions.csv'})}
            type={Button.TYPE.PRIMARY}
            iconType={Button.ICON_TYPE.INTERFACE__OPERATIONS__EXPORT}
          >
            Export
          </Button>
          <Table items={exceptionSummary}>
            <TableHeader>
              {headers.map((h, i) => (
                <TableHeaderCell
                {...h}
                width={h.key == 'Location' ? '50%' : '1fr'}
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
                  <TableRowCell value={item} onClick={() => this.openExceptionDrilldown(item)}><a>{item.exceptionLocation}</a></TableRowCell>
                  <TableRowCell>{item.message == null ? '' : item.message}</TableRowCell>
                  <TableRowCell>{item['Versions Affected']}</TableRowCell>
                  <TableRowCell>{item.count}</TableRowCell>
                  <TableRowCell>{item['Users Affected']}</TableRowCell>
                </TableRow>
              );
            }}
          </Table>
          </>
          :
          <p>No exceptions matching the filters provided</p>
        }
        </div>
      </div>
    )
  }

  render() {
    let { filtersSelected, loading, showExceptionDrilldown, selectedException } = this.state;

    if (loading) {
      return <Spinner />
    } else {
      return (
        <div>
          {this.renderDropdowns()}
          {!showExceptionDrilldown &&
            <>
            <br />
            {this.renderData()}
            </>
          }
          {showExceptionDrilldown && <button style={{float: 'right'}} type="button" onClick={() => this.setState({ showExceptionDrilldown: !showExceptionDrilldown, selectedException: null })}>Back to Exceptions</button>}
          {showExceptionDrilldown && <ExceptionDrilldown rawTime={this.props.rawTime} entity={this.props.entity} selected={selectedException} time={this.props.time} filters={filtersSelected}/>}
        </div>
      );
    }
  }
}
