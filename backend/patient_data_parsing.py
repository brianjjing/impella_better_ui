import pickle as pkl

def parse_all_patient_data():
    with open(f'backend/10min_1hr_all_data.pkl', 'rb') as f:
        data = pkl.load(f)
    return data

data = parse_all_patient_data()
print(data['train'].shape)
print(data['train'])