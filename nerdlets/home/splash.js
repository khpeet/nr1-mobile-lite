import React from 'react';
import { NerdGraphQuery, Spinner, Table, TableHeader, TableHeaderCell, TableRow, TableRowCell, TextField, EntityTitleTableRowCell } from 'nr1';
import Overview from './overview';

const query = require('./utils');

export default class Splash extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      apps: [],
      drilldownOpen: false,
      selected: null
    };
  }

  async componentDidMount() {
    await this.getMobileApps();
    await this.setState({ loading: false });
  }

  async getMobileApps() { //todo: add pagination
    let result = await NerdGraphQuery.query({
      query: query.mobileEntities()
    });

    if (result.error) {
      console.debug(`Failed to fetch mobile entities`);
      console.debug(result.error);
    } else {
      let mobileApps = result.data.actor.entitySearch.results.entities;
      console.log(mobileApps);
      this.setState({ apps: mobileApps });
    }
  }

  openDrilldown(i) {
    this.setState({drilldownOpen: true, selected: i});
  }

  renderTable() {
    const { apps } = this.state;

    const headers = [
      {key: 'Name', value: ({ item }) => item.name},
      {key: 'Account', value: ({ item }) => item.account.name},
      {key: 'appLaunchCount', value: ({ item }) => item.mobileSummary.appLaunchCount},
      {key: 'crashCount', value: ({ item }) => item.mobileSummary.crashCount},
      {key: 'httpErrorRate', value: ({ item }) => item.mobileSummary.httpErrorRate},
      {key: 'usersAffectedCount', value: ({ item }) => item.mobileSummary.usersAffectedCount}
    ];

    return (
      <Table items={apps}>
        <TableHeader>
          {headers.map((h, i) => (
            <TableHeaderCell
            {...h}
            sortable
            >
            {h.key}
            </TableHeaderCell>
          ))}
        </TableHeader>

        {({ item }) => {
          return (
            <TableRow>
              <EntityTitleTableRowCell
              value={item}
              onClick={() => this.openDrilldown(item)}
              />
              <TableRowCell>{item.account.name == null ? '-' : item.account.name}</TableRowCell>
              <TableRowCell>{item.mobileSummary.appLaunchCount == null ? '-' : item.mobileSummary.appLaunchCount}</TableRowCell>
              <TableRowCell>{item.mobileSummary.crashCount == null ? '-' : item.mobileSummary.crashCount}</TableRowCell>
              <TableRowCell>{item.mobileSummary.httpErrorRate == null ? '-' : item.mobileSummary.httpErrorRate}</TableRowCell>
              <TableRowCell>{item.mobileSummary.usersAffectedCount == null ? '-' : item.mobileSummary.usersAffectedCount}</TableRowCell>
            </TableRow>
          );
        }}
      </Table>
    );
  }

  render() {
    let { drilldownOpen, loading, selected } = this.state;
    let { rawTime } = this.props;

    if (loading) {
      return <Spinner />
    } else {
      return (
        <>
          {drilldownOpen && <button style={{float: 'right'}} type="button" onClick={() => this.setState({ drilldownOpen: !drilldownOpen, selected: null })}>Back to App List</button>}
          {drilldownOpen && <h2>{selected.name}</h2>}
          {drilldownOpen && <Overview time={this.props.time} entity={selected} rawTime={rawTime}/>}
          {!drilldownOpen && this.renderTable()}
        </>
      )
    }
  }
}
