import unittest
from datetime import datetime, timedelta, timezone
import numpy as np
from unittest.mock import patch
from fastapi.testclient import TestClient
from app import app
from air_quality import index_for, summarize, nearest, conversion, clean, extract

class AirTests(unittest.TestCase):
    def test_every_breakpoint(self):
        for c, i in [(0,0),(9,50),(9.1,51),(35.4,100),(35.5,101),(55.4,150),(55.5,151),(125.4,200),(125.5,201),(225.4,300),(225.5,301),(325.4,500)]:
            with self.subTest(c=c): self.assertEqual(index_for(c)["aqi"],i)

    def test_truncation(self):
        for c, t in [(9.09,9.0),(9.10,9.1),(35.49,35.4)]:
            with self.subTest(c=c): self.assertEqual(index_for(c)["truncatedPm25"],t)

    def test_half_up_and_beyond(self):
        self.assertEqual(index_for(4.5)["aqi"],25)
        self.assertTrue(index_for(325.5)["aboveScale"])
        self.assertIsNone(index_for(325.5)["aqi"])

    def rows(self,n=48):
        start=datetime(2026,11,1,tzinfo=timezone.utc)
        return [dict(intervalStart=(start+timedelta(hours=h)).isoformat().replace('+00:00','Z'),intervalEnd=(start+timedelta(hours=h+1)).isoformat().replace('+00:00','Z'),pm25=0) for h in range(n)]

    def test_zero_complete(self):
        w,d=summarize(self.rows())
        self.assertEqual(w[23]['aqi'],0)
        self.assertEqual(d[0]['validHours'],24)
        self.assertIsNone(w[22]['aqi'])

    def test_missing(self):
        rows=self.rows();rows[5]['pm25']=None
        self.assertIsNone(summarize(rows)[0][23]['aqi'])

    def test_duplicate(self):
        rows=self.rows();rows[5]=rows[4].copy()
        self.assertIsNone(summarize(rows)[0][23]['aqi'])

    def test_gap_partial_day(self):
        rows=self.rows()[9:33]
        w,d=summarize(rows)
        self.assertEqual(w[-1]['validHours'],24)
        self.assertTrue(all(r['aqi'] is None for r in d))

    def test_mean_not_average_indices(self):
        rows=self.rows(24)
        for h in range(12): rows[h]['pm25']=70.98
        self.assertEqual(summarize(rows)[0][-1]['truncatedPm25'],35.4)
        self.assertEqual(summarize(rows)[0][-1]['aqi'],100)

    def test_dateline_western_same_cell(self):
        lats=np.array([-90,0,51.5,90]);lons=np.array([-180,-.25,103.75,179.75])
        self.assertEqual(nearest(lats,lons,51.507,-.1278),(2,1))
        self.assertEqual(nearest(lats,lons,0,180),(1,0))
        self.assertEqual(nearest(lats,lons,0,-179.99),(1,0))

    def test_units(self):
        self.assertEqual(conversion('kg m-3'),1e9)
        self.assertEqual(conversion('ug m-3'),1)
        with self.assertRaises(ValueError): conversion('unknown')

    def test_fill_negative_zero(self):
        sentinel=999999986991104.0
        self.assertIsNone(clean(sentinel,{'missing_value':sentinel},sentinel))
        self.assertIsNone(clean(-1,{},None))
        self.assertIsNone(clean(float('nan'),{},None))
        self.assertEqual(clean(0,{},None),0)

    def test_bounds(self):
        with self.assertRaises(ValueError): extract([{'latitude':91,'longitude':0}],24)
        with self.assertRaises(ValueError): extract([{'latitude':0,'longitude':0}],25)

    def test_authenticated_bounded_api(self):
        with patch.dict('os.environ', {'FORECAST_SERVICE_TOKEN': 'unit-test-only-token'}):
            client=TestClient(app)
            payload={'points':[{'latitude':1.4927,'longitude':103.7414}], 'horizon':24}
            self.assertEqual(client.post('/air-quality',json=payload).status_code,401)
            headers={'Authorization':'Bearer unit-test-only-token'}
            with patch('app.extract',return_value=[{'source':'NASA GEOS-CF'}]) as adapter:
                response=client.post('/air-quality',json=payload,headers=headers)
                self.assertEqual(response.json()['results'][0]['source'],'NASA GEOS-CF')
                adapter.assert_called_once_with(payload['points'],24)
            payload['horizon']=25
            self.assertEqual(client.post('/air-quality',json=payload,headers=headers).status_code,422)

if __name__ == '__main__': unittest.main()