import React from 'react';
import { AreaChart, BarChart, LineChart, NerdGraphQuery, PlatformStateContext, PieChart, Spinner, Table, TableHeader, TableHeaderCell, TableRow, TableRowCell } from 'nr1';
import Select, { components } from 'react-select';
import HttpErrorDrilldown from './httpErrors-drilldown';

const query = require('./utils');

export default class HttpErrors extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      versionSelected: {'value': 'all', 'label': 'All Versions'},
      versions: [],
      filtersSelected: [],
      filters: [],
      groupSelected: {'value': 'requestDomain', 'label': 'Request Domain'},
      httpErrorSummary: [],
      column_2: TableHeaderCell.SORTING_TYPE.DESCENDING,
      showHttpDrilldown: false,
      selectedRequestUrl: null
    };
  }

  async componentDidMount() {
    let { appVersions, appFilters } = this.props
    await this.getHttpData();
    await this.setState({ versions: appVersions, filters: appFilters });
    await this.setState({ loading: false });
  }

  async componentDidUpdate(prevProps, prevState) {
    if (prevState.versionSelected !== this.state.versionSelected ||
        prevState.filtersSelected !== this.state.filtersSelected ||
        prevProps.time !== this.props.time) {
      await this.getHttpData();
    }
  }

  async getHttpData() {
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

    const res = await NerdGraphQuery.query({ query: query.mobileHttpErrors(entity.account.id, time, entity.guid, filterString, versionString)});

    if (res.error) {
      console.debug(`Failed to retrieve exception summary for entity: ${entity.name}`);
    } else {
      let httpErrorSummary = res.data.actor.account.httpErrors.results;
      let filtered = httpErrorSummary.filter((el) => el.occurrences > 0);

      let formattedTable = await this.formatTableData(filtered);

      await this.setState({httpErrorSummary: formattedTable});
    }
  }

  formatTableData(f) {
    for (var z=0; z < f.length; z++) {
      f[z].code = '';

      if (f[z].facet[1] == null && f[z].facet[2] !== null) {
        f[z].code = f[z].facet[2];
        f[z].type = 'network';
      }
      if (f[z].facet[1] !== null && f[z].facet[2] == null) {
        f[z].code = f[z].facet[1];
        f[z].type='http';
      }
    }

    return f;
  }

  renderDropdowns() {
    let { filters, filtersSelected, groupSelected, showHttpDrilldown, versions, versionSelected } = this.state;

    let groups = [
      {'value': 'requestDomain', 'label': 'Request Domain'},
      {'value': 'requestUrl', 'label': 'Request Url'},
      {'value': 'requestMethod', 'label': 'Request Method'},
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
        isDisabled={showHttpDrilldown}
        aria-label="Versions"
        closeMenuOnSelect={true}
        defaultValue={versionSelected}
        isSearchable
        options={versions}
        onChange={(e) => this.setState({ versionSelected: e })}
      />
      <h5 style={{textAlign: 'center'}}>Versions</h5>
      </div>
      <div style={{display: 'inline-block', marginRight: '8px'}}>
      <Select
        aria-label="Filters"
        components={{ MultiValueLabel }}
        closeMenuOnSelect={false}
        placeholder='Filter...'
        isSearchable
        isMulti
        options={filters}
        onChange={(e) => this.setState({ filtersSelected: e })}
      />
      <h5 style={{textAlign: 'center'}}>Filters</h5>
      </div>
      <div style={{display: 'inline-block', marginRight: '8px'}}>
      <Select
        isDisabled={showHttpDrilldown}
        aria-label="Groups"
        closeMenuOnSelect={true}
        defaultValue={groupSelected}
        isSearchable
        options={groups}
        onChange={(e) => this.setState({ groupSelected: e })}
      />
      <h5 style={{textAlign: 'center'}}>Group by</h5>
      </div>
      </>
    );
  }

  _onClickTableHeaderCell(key, event, sortingData) {
    this.setState({ [key]: sortingData.nextSortingType });
  }

  openHttpDrilldown(i) {
    this.setState({showHttpDrilldown: true, selectedRequestUrl: i});
  }

  renderData() {
    let { httpErrorSummary, filters, filtersSelected, groupSelected, versions, versionSelected } = this.state;
    let { entity, time } = this.props;
    let filterString = '';
    let versionString = '';
    let versionIdString = '';

    const headers = [
      {key: 'Code/Message', value: ({ item }) => item.code},
      {key: 'Request URL', value: ({ item }) => item.facet[0]},
      {key: 'Occurrences', value: ({ item }) => item.occurrences}
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

    let totals = `FROM MobileRequestError SELECT count(*) where entityGuid = '${entity.guid}' ${versionString} ${filterString} facet ${groupSelected.value} ${time} LIMIT 25`;
    let errorsAndFailures = `SELECT count(*) FROM MobileRequestError WHERE (entityGuid = '${entity.guid}' ${versionString}) ${filterString} FACET errorType ${time} TIMESERIES`;
    let errorAndFailureRate = `SELECT percentage(count(*), where errorType is not null) AS 'Errors and Failures Rate %' FROM MobileRequestError, MobileRequest WHERE (entityGuid = '${entity.guid}' ${versionString}) ${filterString} ${time} TIMESERIES`;
    let topGroup = `SELECT count(*) FROM MobileRequestError WHERE (entityGuid = '${entity.guid}' ${versionIdString}) FACET ${groupSelected.value} ${time} LIMIT 5 TIMESERIES`;

    return (
      <div>
        <div style={{width: '45%', marginTop: '30px', display: 'inline-block', marginRight: '20px'}}>
          <h4>Request Counts</h4>
          <BarChart
            accountIds={[entity.account.id]}
            query={totals}
            fullWidth
            style={{display: 'inline-block'}}
          />
        </div>
        <div style={{width: '25%', marginTop: '30px', display: 'inline-block', marginRight: '20px'}}>
          <h4>Errors and failures</h4>
          <LineChart
            accountIds={[entity.account.id]}
            query={errorsAndFailures}
            fullWidth
            style={{display: 'inline-block'}}
          />
        </div>
        <div style={{width: '25%', marginTop: '30px', display: 'inline-block'}}>
          <h4>Error and failure rate</h4>
          <AreaChart
            accountIds={[entity.account.id]}
            query={errorAndFailureRate}
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
          httpErrorSummary.length > 0
          ?
          <>
          <h4>Errors and failures</h4>
          <Table items={httpErrorSummary}>
            <TableHeader>
              {headers.map((h, i) => (
                <TableHeaderCell
                {...h}
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
                  <TableRowCell>{item.code}</TableRowCell>
                  <TableRowCell value={item} onClick={() => this.openHttpDrilldown(item)}><a>{item.facet[0]}</a></TableRowCell>
                  <TableRowCell>{item.occurrences}</TableRowCell>
                </TableRow>
              );
            }}
          </Table>
          </>
          :
          <p>No http or network errors matching the filters provided</p>
        }
        </div>
      </div>
    )
  }

  render() {
    let { filtersSelected, loading, showHttpDrilldown, selectedRequestUrl } = this.state;

    if (loading) {
      return <Spinner />
    } else {
      return (
        <div>
          {this.renderDropdowns()}
          {!showHttpDrilldown &&
            <>
            <br />
            {this.renderData()}
            </>
          }
          {showHttpDrilldown && <button style={{float: 'right'}} type="button" onClick={() => this.setState({ showHttpDrilldown: !showHttpDrilldown, selectedRequestUrl: null })}>Back to HTTP Errors</button>}
          {showHttpDrilldown && <HttpErrorDrilldown rawTime={this.props.rawTime} entity={this.props.entity} selected={selectedRequestUrl} time={this.props.time} filters={filtersSelected}/>}
        </div>
      );
    }
  }
}
