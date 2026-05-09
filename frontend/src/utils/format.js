import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

export const formatDate = (date, fmt = 'D [de] MMMM YYYY') =>
  dayjs(date).format(fmt)

export const formatCurrency = (amount, symbol = 'S/.') =>
  `${symbol} ${Number(amount).toFixed(2)}`
